import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ListingController } from './listing.controller';
import { ListingService } from './listing.service';
import { Listing, ListingSchema } from './schemas/listing.schema';
import { ListingRepo } from './listing.repo';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Listing.name, schema: ListingSchema }]),
  ],
  controllers: [ListingController],
  providers: [ListingService, ListingRepo],
  exports: [ListingService, ListingRepo],
})
export class ListingModule {}
