import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Property } from '../../modules/properties/schemas/property.schema';
import { GooglePlacesService } from '../../modules/location/google-places.service';

@Injectable()
export class AddCoordinatesToPropertiesMigration {
  private readonly logger = new Logger(
    AddCoordinatesToPropertiesMigration.name,
  );

  constructor(
    @InjectModel(Property.name) private propertyModel: Model<Property>,
    private googlePlacesService: GooglePlacesService,
  ) {}

  async execute(): Promise<void> {
    this.logger.log(
      'Starting migration: Add coordinates and place_id to properties...',
    );

    try {
      // Find all properties without coordinates or place_id
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

      let updatedCount = 0;
      let errorCount = 0;

      for (const property of properties) {
        try {
          if (property.location?.lat && property.location?.lng) {
            const coordinates = [property.location.lng, property.location.lat];
            const updateData: any = {
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
                  // Use the first (most relevant) suggestion
                  updateData['location.place_id'] =
                    placeSuggestions[0].place_id;
                  this.logger.log(
                    `Found place_id for property ${String(property._id)}: ${placeSuggestions[0].place_id}`,
                  );
                }
              } catch (placeError) {
                this.logger.warn(
                  `Could not find place_id for property ${String(property._id)}: ${(placeError as Error).message}`,
                );
              }
            }

            await this.propertyModel.updateOne(
              { _id: property._id },
              {
                $set: updateData,
              },
            );

            updatedCount++;

            if (updatedCount % 50 === 0) {
              this.logger.log(`Updated ${updatedCount} properties...`);
            }
          } else {
            this.logger.warn(
              `Property ${String(property._id)} has invalid lat/lng values`,
            );
            errorCount++;
          }
        } catch (error) {
          this.logger.error(
            `Error updating property ${String(property._id)}: ${(error as Error).message}`,
          );
          errorCount++;
        }
      }

      // Create 2dsphere index if it doesn't exist
      try {
        await this.propertyModel.collection.createIndex({
          'location.coordinates': '2dsphere',
        });
        this.logger.log('2dsphere index created successfully');
      } catch (indexError) {
        this.logger.warn(
          `Index creation warning: ${(indexError as Error).message}`,
        );
      }

      this.logger.log(
        `Migration completed: ${updatedCount} properties updated, ${errorCount} errors`,
      );
    } catch (error) {
      this.logger.error(`Migration failed: ${(error as Error).message}`);
      throw error;
    }
  }

  async rollback(): Promise<void> {
    this.logger.log(
      'Rolling back migration: Remove coordinates from properties...',
    );

    try {
      const result = await this.propertyModel.updateMany(
        {},
        {
          $unset: {
            'location.coordinates': '',
          },
        },
      );

      this.logger.log(
        `Rollback completed: ${result.modifiedCount} properties updated`,
      );
    } catch (error) {
      this.logger.error(`Rollback failed: ${(error as Error).message}`);
      throw error;
    }
  }
}

// Command để chạy migration
export class MigrationCommand {
  constructor(
    private readonly migration: AddCoordinatesToPropertiesMigration,
  ) {}

  async run(action: 'migrate' | 'rollback' = 'migrate'): Promise<void> {
    if (action === 'rollback') {
      await this.migration.rollback();
    } else {
      await this.migration.execute();
    }
  }
}
