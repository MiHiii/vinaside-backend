import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingController } from './booking.controller';
import { Booking, BookingSchema } from './schemas/booking.schema';
import { BookingService } from './booking.service';
import { BookingRepo } from './booking.repo';
import { ListingModule } from '../listing/listing.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Booking.name, schema: BookingSchema }]),
    ListingModule,
  ],
  controllers: [BookingController],
  providers: [BookingService, BookingRepo],
  exports: [BookingService, BookingRepo],
})
export class BookingModule {}
