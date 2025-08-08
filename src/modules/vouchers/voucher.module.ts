import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VoucherController } from './voucher.controller';
import { VoucherService } from './voucher.service';
import { VoucherRepo } from './voucher.repo';
import { Voucher, VoucherSchema } from './schemas/voucher.schema';
import {
  VoucherUsage,
  VoucherUsageSchema,
} from './schemas/voucher-usage.schema';
import { BookingModule } from '../booking/booking.module';
import { Booking, BookingSchema } from '../booking/schemas/booking.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Voucher.name, schema: VoucherSchema },
      { name: VoucherUsage.name, schema: VoucherUsageSchema },
      { name: Booking.name, schema: BookingSchema },
    ]),
    forwardRef(() => BookingModule),
  ],
  controllers: [VoucherController],
  providers: [VoucherService, VoucherRepo],
  exports: [VoucherService, VoucherRepo],
})
export class VoucherModule {}
