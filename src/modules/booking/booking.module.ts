import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { BookingController } from './booking.controller';
import { Booking, BookingSchema } from './schemas/booking.schema';
import { BookingService } from './booking.service';
import { BookingRepo } from './booking.repo';
import { VNPayService } from './services/vnpay.service';
import { PaymentFactory } from './services/payment.factory';
import { ListingModule } from '../listing/listing.module';
import { PropertyModule } from '../properties/property.module';
import { MailModule } from '../mail/mail.module';
import { VoucherModule } from '../vouchers/voucher.module';
import { ServicesModule } from '../services/services.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PropertyStaffAssignmentModule } from '../property-staff-assignment/property-staff-assignment.module';
import { StaffFilterInterceptor } from '../../common/interceptors/staff-filter.interceptor';
import { forwardRef } from '@nestjs/common';
import { ReviewsModule } from '../reviews/reviews.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Booking.name, schema: BookingSchema }]),
    ConfigModule,
    ListingModule,
    PropertyModule,
    MailModule,
    forwardRef(() => VoucherModule),
    forwardRef(() => ServicesModule),
    NotificationsModule,
    PropertyStaffAssignmentModule,
    forwardRef(() => ReviewsModule),
    TransactionsModule,
  ],
  controllers: [BookingController],
  providers: [
    BookingService,
    BookingRepo,
    VNPayService,
    PaymentFactory,
    {
      provide: APP_INTERCEPTOR,
      useClass: StaffFilterInterceptor,
    },
  ],
  exports: [BookingService],
})
export class BookingModule {}
