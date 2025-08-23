import {
  IsDateString,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  IsArray,
  ValidateNested,
  IsNumber,
  IsEmail,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class StaffBookingServiceDto {
  @IsMongoId()
  @IsNotEmpty()
  serviceId: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity: number = 1;
}

export class StaffCreateBookingDto {
  @IsMongoId()
  @IsNotEmpty()
  propertyId: string;

  @IsMongoId()
  @IsNotEmpty()
  listingId: string;

  @IsOptional()
  @IsMongoId({
    message: 'guestId phải là ObjectId hợp lệ hoặc không được truyền',
  })
  guestId?: string; // Optional - staff có thể tạo booking cho guest

  @IsDateString()
  @IsNotEmpty()
  checkInDate: string;

  @IsDateString()
  @IsNotEmpty()
  checkOutDate: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  guests: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  infants?: number = 0;

  @IsString()
  @IsNotEmpty()
  guest_name: string;

  @IsEmail()
  @IsNotEmpty()
  guest_email: string;

  @IsString()
  @IsOptional()
  guest_phone?: string;

  @IsString()
  @IsOptional()
  specialRequests?: string;

  @IsString()
  @IsOptional()
  voucherCode?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StaffBookingServiceDto)
  @IsOptional()
  services?: StaffBookingServiceDto[];

  @IsString()
  @IsOptional()
  note?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  additionalCost?: number = 0;

  @IsString()
  @IsOptional()
  additionalCostReason?: string;

  @IsString()
  @IsOptional()
  status?: string = 'pending';

  @IsString()
  @IsOptional()
  payment_status?: string = 'unpaid';

  @IsString()
  @IsOptional()
  payment_method?: string = 'cash';

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  deposit_paid_amount?: number = 0;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  price_per_night?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  final_amount?: number;

  @IsBoolean()
  @IsOptional()
  skip_availability_check?: boolean = false;
}
