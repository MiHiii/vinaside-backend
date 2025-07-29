import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InternalDataController } from './internal-data.controller';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Listing, ListingSchema } from '../listing/schemas/listing.schema';
import {
  Property,
  PropertySchema,
} from '../properties/schemas/property.schema';
import { Booking, BookingSchema } from '../booking/schemas/booking.schema';
import { Voucher, VoucherSchema } from '../vouchers/schemas/voucher.schema';
import { Review, ReviewSchema } from '../reviews/schemas/review.schema';
import { Service, ServiceSchema } from '../services/schemas/service.schema';
import { Wishlist, WishlistSchema } from '../wishlist/schemas/wishlist.schema';
import { Message, MessageSchema } from '../messages/schemas/message.schema';
import {
  Notification,
  NotificationSchema,
} from '../notifications/schemas/notification.schema';
import {
  VoucherUsage,
  VoucherUsageSchema,
} from '../vouchers/schemas/voucher-usage.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Listing.name, schema: ListingSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Voucher.name, schema: VoucherSchema },
      { name: Review.name, schema: ReviewSchema },
      { name: Service.name, schema: ServiceSchema },
      { name: Wishlist.name, schema: WishlistSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: VoucherUsage.name, schema: VoucherUsageSchema },
    ]),
  ],
  controllers: [InternalDataController],
})
export class InternalDataModule {}
