import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
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
    VoucherModule,
    ServicesModule,
    NotificationsModule,
    forwardRef(() => ReviewsModule),
    TransactionsModule,
  ],
  controllers: [BookingController],
  providers: [BookingService, BookingRepo, VNPayService, PaymentFactory],
  exports: [BookingService, BookingRepo, VNPayService, PaymentFactory],
})
export class BookingModule {}
