import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PropertyService } from './services/property.service';
import { PropertyController } from './controllers/property.controller';
import { Property, PropertySchema } from './schemas/property.schema';
import { Listing, ListingSchema } from '../listing/schemas/listing.schema';
import { Booking, BookingSchema } from '../booking/schemas/booking.schema';
import { Review, ReviewSchema } from '../reviews/schemas/review.schema';
import { Voucher, VoucherSchema } from '../vouchers/schemas/voucher.schema';
import { Service, ServiceSchema } from '../services/schemas/service.schema';
import { LocationModule } from '../location/location.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Property.name, schema: PropertySchema },
      { name: Listing.name, schema: ListingSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Review.name, schema: ReviewSchema },
      { name: Voucher.name, schema: VoucherSchema },
      { name: Service.name, schema: ServiceSchema },
    ]),
    LocationModule,
  ],
  controllers: [PropertyController],
  providers: [PropertyService],
  exports: [PropertyService],
})
export class PropertyModule {}
