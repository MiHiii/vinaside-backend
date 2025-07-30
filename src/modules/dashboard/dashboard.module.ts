import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  Property,
  PropertySchema,
} from '../properties/schemas/property.schema';
import { Listing, ListingSchema } from '../listing/schemas/listing.schema';
import { Booking, BookingSchema } from '../booking/schemas/booking.schema';
import { Review, ReviewSchema } from '../reviews/schemas/review.schema';
import { Voucher, VoucherSchema } from '../vouchers/schemas/voucher.schema';
import { Service, ServiceSchema } from '../services/schemas/service.schema';
import { Message, MessageSchema } from '../messages/schemas/message.schema';
import {
  VoucherUsage,
  VoucherUsageSchema,
} from '../vouchers/schemas/voucher-usage.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Listing.name, schema: ListingSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Review.name, schema: ReviewSchema },
      { name: Voucher.name, schema: VoucherSchema },
      { name: VoucherUsage.name, schema: VoucherUsageSchema },
      { name: Service.name, schema: ServiceSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
