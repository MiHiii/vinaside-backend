import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { BookingRepo } from './booking.repo';
import { Booking, BookingSchema } from './schemas/booking.schema';
import { Listing, ListingSchema } from '../listing/schemas/listing.schema';
import { ListingModule } from '../listing/listing.module';
import { PropertyModule } from '../properties/property.module';
import { MailModule } from '../mail/mail.module';
import { VoucherModule } from '../vouchers/voucher.module';
import { ServicesModule } from '../services/services.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PropertyStaffAssignmentModule } from '../property-staff-assignment/property-staff-assignment.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { PaymentFactory } from './services/payment.factory';
import { VNPayService } from './services/vnpay.service';
import { CashService } from './services/cash.service';
import { BookingNotificationService } from './services/booking-notification.service';
import { BookingNotificationStatusService } from './services/booking-notification-status.service';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: Listing.name, schema: ListingSchema },
    ]),
    forwardRef(() => ListingModule),
    forwardRef(() => PropertyModule),
    forwardRef(() => MailModule),
    forwardRef(() => VoucherModule),
    forwardRef(() => ServicesModule),
    forwardRef(() => NotificationsModule),
    forwardRef(() => PropertyStaffAssignmentModule),
    forwardRef(() => ReviewsModule),
    forwardRef(() => TransactionsModule),
  ],
  controllers: [BookingController],
  providers: [
    BookingService,
    BookingRepo,
    PaymentFactory,
    VNPayService,
    CashService,
    BookingNotificationService,
    BookingNotificationStatusService,
  ],
  exports: [BookingService, BookingRepo],
})
export class BookingModule {}
