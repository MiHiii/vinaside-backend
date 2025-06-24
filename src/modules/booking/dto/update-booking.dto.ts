import { IsEnum, IsOptional } from 'class-validator';
import { BookingStatus, PaymentStatus } from '../schemas/booking.schema';

export class UpdateBookingDto {
  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;

  @IsEnum(PaymentStatus)
  @IsOptional()
  paymentStatus?: PaymentStatus;
}
