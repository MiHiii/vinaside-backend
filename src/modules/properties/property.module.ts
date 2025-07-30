import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PropertyService } from './services/property.service';
import { PropertyController } from './controllers/property.controller';
import { Property, PropertySchema } from './schemas/property.schema';
import { Listing, ListingSchema } from '../listing/schemas/listing.schema';
import { Booking, BookingSchema } from '../booking/schemas/booking.schema';
import { Review, ReviewSchema } from '../reviews/schemas/review.schema';
import { Voucher, VoucherSchema } from '../vouchers/schemas/voucher.schema';
import { Service, ServiceSchema } from '../services/schemas/service.schema';
import { LocationModule } from '../location/location.module';
import { PropertyStaffAssignmentModule } from '../property-staff-assignment/property-staff-assignment.module';
import { StaffFilterInterceptor } from '../../common/interceptors/staff-filter.interceptor';

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
    PropertyStaffAssignmentModule,
  ],
  controllers: [PropertyController],
  providers: [
    PropertyService,
    {
      provide: APP_INTERCEPTOR,
      useClass: StaffFilterInterceptor,
    },
  ],
  exports: [PropertyService],
})
export class PropertyModule {}
