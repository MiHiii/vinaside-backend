import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ListingController } from './listing.controller';
import { Listing, ListingSchema } from './schemas/listing.schema';
import { ListingService } from './listing.service';
import { ListingRepo } from './listing.repo';
import { LocationModule } from '../location/location.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Listing.name, schema: ListingSchema }]),
    LocationModule,
  ],
  controllers: [ListingController],
  providers: [ListingService, ListingRepo],
  exports: [ListingService, ListingRepo],
})
export class ListingModule {}
