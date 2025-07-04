import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PropertyService } from './services/property.service';
import { PropertyController } from './controllers/property.controller';
import { Property, PropertySchema } from './schemas/property.schema';
import { Listing, ListingSchema } from '../listing/schemas/listing.schema';
import { Booking, BookingSchema } from '../booking/schemas/booking.schema';
import { Review, ReviewSchema } from '../reviews/schemas/review.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Property.name, schema: PropertySchema },
      { name: Listing.name, schema: ListingSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Review.name, schema: ReviewSchema },
    ]),
  ],
  controllers: [PropertyController],
  providers: [PropertyService],
  exports: [PropertyService],
})
export class PropertyModule {}
