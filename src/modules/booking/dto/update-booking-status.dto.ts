import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '../schemas/booking.schema';

export class UpdateBookingStatusDto {
  @ApiProperty({
    description: 'Trạng thái mới của booking',
    enum: [
      BookingStatus.CONFIRMED,
      BookingStatus.REJECTED,
      BookingStatus.COMPLETED,
    ],
    example: BookingStatus.CONFIRMED,
  })
  @IsNotEmpty({ message: 'Trạng thái không được để trống' })
  @IsEnum(
    [BookingStatus.CONFIRMED, BookingStatus.REJECTED, BookingStatus.COMPLETED],
    {
      message:
        'Trạng thái không hợp lệ. Chỉ cho phép: confirmed, rejected, completed',
    },
  )
  status:
    | BookingStatus.CONFIRMED
    | BookingStatus.REJECTED
    | BookingStatus.COMPLETED;
}
