import { Command, CommandRunner } from 'nest-commander';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Property } from '../../modules/properties/schemas/property.schema';
import { GooglePlacesService } from '../../modules/location/google-places.service';

interface MigratePropertiesLocationOptions {
  action?: string;
  dryRun?: boolean;
}

@Injectable()
@Command({
  name: 'migrate:properties-location',
  description: 'Add coordinates and place_id to existing properties',
  options: [
    {
      flags: '-a, --action <action>',
      description: 'Action to perform: migrate or rollback',
      defaultValue: 'migrate',
    },
    {
      flags: '-d, --dry-run',
      description: 'Show what would be changed without actually changing it',
      defaultValue: false,
    },
  ],
})
export class MigratePropertiesLocationCommand extends CommandRunner {
  private readonly logger = new Logger(MigratePropertiesLocationCommand.name);

  constructor(
    @InjectModel(Property.name) private propertyModel: Model<Property>,
    private googlePlacesService: GooglePlacesService,
  ) {
    super();
  }

  async run(
    passedParam: string[],
    options: MigratePropertiesLocationOptions,
  ): Promise<void> {
    const { action = 'migrate', dryRun = false } = options;

    this.logger.log(
      `Starting ${action} for properties location... ${dryRun ? '(DRY RUN)' : ''}`,
    );

    if (action === 'rollback') {
      await this.rollback(dryRun);
    } else {
      await this.migrate(dryRun);
    }

    this.logger.log('Command completed!');
  }

  private async migrate(dryRun: boolean): Promise<void> {
    try {
      // Find properties that need updating
      const properties = await this.propertyModel.find({
        $or: [
          { 'location.coordinates': { $exists: false } },
          { 'location.coordinates': null },
          { 'location.coordinates': [] },
          { 'location.place_id': { $exists: false } },
          { 'location.place_id': null },
        ],
        'location.lat': { $exists: true },
        'location.lng': { $exists: true },
        isDeleted: false,
      });

      this.logger.log(`Found ${properties.length} properties to update`);

      if (dryRun) {
        this.logger.log('DRY RUN - Would update the following properties:');
        for (const property of properties.slice(0, 5)) {
          this.logger.log(
            `- ${property._id}: ${property.location?.address || 'No address'}`,
          );
        }
        if (properties.length > 5) {
          this.logger.log(`... and ${properties.length - 5} more`);
        }
        return;
      }

      let updatedCount = 0;
      let errorCount = 0;

      for (const property of properties) {
        try {
          if (property.location?.lat && property.location?.lng) {
            const coordinates = [property.location.lng, property.location.lat];
            const updateData: Record<string, any> = {
              'location.coordinates': coordinates,
            };

            // Try to get place_id from Google Places if address exists
            if (property.location.address && !property.location.place_id) {
              try {
                const placeSuggestions =
                  await this.googlePlacesService.autocomplete(
                    property.location.address,
                    'all',
                  );

                if (placeSuggestions.length > 0) {
                  updateData['location.place_id'] =
                    placeSuggestions[0].place_id;
                  this.logger.log(
                    `Found place_id for ${property._id}: ${placeSuggestions[0].place_id}`,
                  );
                }
              } catch (placeError) {
                this.logger.warn(
                  `Could not find place_id for ${property._id}: ${placeError}`,
                );
              }
            }

            await this.propertyModel.updateOne(
              { _id: property._id },
              { $set: updateData },
            );

            updatedCount++;

            if (updatedCount % 50 === 0) {
              this.logger.log(`Updated ${updatedCount} properties...`);
            }
          }
        } catch (error) {
          this.logger.error(
            `Error updating property ${property._id}: ${error}`,
          );
          errorCount++;
        }
      }

      // Create indexes
      try {
        await this.propertyModel.collection.createIndex({
          'location.coordinates': '2dsphere',
        });
        await this.propertyModel.collection.createIndex({
          'location.place_id': 1,
        });
        this.logger.log('Indexes created successfully');
      } catch (indexError) {
        this.logger.warn(`Index creation warning: ${indexError}`);
      }

      this.logger.log(
        `Migration completed: ${updatedCount} updated, ${errorCount} errors`,
      );
    } catch (error) {
      this.logger.error(`Migration failed: ${error}`);
      throw error;
    }
  }

  private async rollback(dryRun: boolean): Promise<void> {
    try {
      const filter = {
        $or: [
          { 'location.coordinates': { $exists: true } },
          { 'location.place_id': { $exists: true } },
        ],
      };

      if (dryRun) {
        const count = await this.propertyModel.countDocuments(filter);
        this.logger.log(
          `DRY RUN - Would remove coordinates and place_id from ${count} properties`,
        );
        return;
      }

      const result = await this.propertyModel.updateMany(filter, {
        $unset: {
          'location.coordinates': '',
          'location.place_id': '',
        },
      });

      this.logger.log(
        `Rollback completed: ${result.modifiedCount} properties updated`,
      );
    } catch (error) {
      this.logger.error(`Rollback failed: ${error}`);
      throw error;
    }
  }
}
