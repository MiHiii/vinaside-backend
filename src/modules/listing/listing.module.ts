import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ListingController } from './listing.controller';
import { Listing, ListingSchema } from './schemas/listing.schema';
import { ListingService } from './listing.service';
import { ListingRepo } from './listing.repo';
import { LocationModule } from '../location/location.module';
import { PropertyModule } from '../properties/property.module';
import { Booking, BookingSchema } from '../booking/schemas/booking.schema';
import { Review, ReviewSchema } from '../reviews/schemas/review.schema';
import { Wishlist, WishlistSchema } from '../wishlist/schemas/wishlist.schema';
import {
  Transaction,
  TransactionSchema,
} from '../transactions/schemas/transaction.schema';
import { Service, ServiceSchema } from '../services/schemas/service.schema';
import {
  Property,
  PropertySchema,
} from '../properties/schemas/property.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Listing.name, schema: ListingSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Review.name, schema: ReviewSchema },
      { name: Wishlist.name, schema: WishlistSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: Service.name, schema: ServiceSchema },
      { name: Property.name, schema: PropertySchema },
    ]),
    LocationModule,
    PropertyModule,
  ],
  controllers: [ListingController],
  providers: [ListingService, ListingRepo],
  exports: [ListingService, ListingRepo],
})
export class ListingModule {}
