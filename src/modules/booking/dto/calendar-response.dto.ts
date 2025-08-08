import { ApiProperty } from '@nestjs/swagger';

export class CalendarBookingDto {
  @ApiProperty()
  _id: string;

  @ApiProperty()
  guest_name: string;

  @ApiProperty()
  guest_email: string;

  @ApiProperty()
  checkInDate: Date;

  @ApiProperty()
  checkOutDate: Date;

  @ApiProperty()
  guests: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  payment_status: string;

  @ApiProperty()
  final_amount: number;

  @ApiProperty()
  listing_title?: string;

  @ApiProperty()
  property_name?: string;

  @ApiProperty()
  note?: string;

  @ApiProperty()
  additionalCost?: number;
}

export class CalendarDayDto {
  @ApiProperty()
  date: string;

  @ApiProperty()
  dayOfWeek: string;

  @ApiProperty()
  isToday: boolean;

  @ApiProperty()
  isWeekend: boolean;

  @ApiProperty({ type: [CalendarBookingDto] })
  bookings: CalendarBookingDto[];

  @ApiProperty()
  totalBookings: number;

  @ApiProperty()
  totalRevenue: number;
}

export class CalendarResponseDto {
  @ApiProperty()
  startDate: string;

  @ApiProperty()
  endDate: string;

  @ApiProperty()
  viewType: string;

  @ApiProperty({ type: [CalendarDayDto] })
  days: CalendarDayDto[];

  @ApiProperty()
  totalBookings: number;

  @ApiProperty()
  totalRevenue: number;

  @ApiProperty()
  averageOccupancy: number;
}
