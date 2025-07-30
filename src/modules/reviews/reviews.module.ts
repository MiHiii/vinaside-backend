import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsRepo } from './reviews.repo';
import { Review, ReviewSchema } from './schemas/review.schema';
import { PropertyModule } from '../properties/property.module';
import { ListingModule } from '../listing/listing.module';
import { Listing, ListingSchema } from '../listing/schemas/listing.schema';
import { PropertyStaffAssignmentModule } from '../property-staff-assignment/property-staff-assignment.module';
import { StaffFilterInterceptor } from '../../common/interceptors/staff-filter.interceptor';
import { forwardRef } from '@nestjs/common';
import { BookingModule } from '../booking/booking.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Review.name, schema: ReviewSchema },
      { name: Listing.name, schema: ListingSchema },
    ]),
    PropertyModule,
    ListingModule,
    PropertyStaffAssignmentModule,
    forwardRef(() => BookingModule),
    NotificationsModule,
  ],
  controllers: [ReviewsController],
  providers: [
    ReviewsService,
    ReviewsRepo,
    {
      provide: APP_INTERCEPTOR,
      useClass: StaffFilterInterceptor,
    },
  ],
  exports: [ReviewsService, ReviewsRepo],
})
export class ReviewsModule {}
