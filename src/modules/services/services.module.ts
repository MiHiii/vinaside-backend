import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';
import { Service, ServiceSchema } from './schemas/service.schema';
import { ServicesRepo } from './services.repo';
import { BookingModule } from '../booking/booking.module';
import { Booking, BookingSchema } from '../booking/schemas/booking.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Service.name, schema: ServiceSchema },
      { name: Booking.name, schema: BookingSchema },
    ]),
    forwardRef(() => BookingModule),
  ],
  controllers: [ServicesController],
  providers: [ServicesService, ServicesRepo],
  exports: [ServicesService, ServicesRepo],
})
export class ServicesModule {}
