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
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../../transactions/schemas/transaction.schema';

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

  // =================== PAYMENT INTEGRATION FIELDS ===================

  @ApiPropertyOptional({
    description: 'Có tạo URL thanh toán VNPay ngay sau khi tạo booking không',
    example: true,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  create_payment_url?: boolean = false;

  @ApiPropertyOptional({
    description:
      'Phương thức thanh toán (chỉ cần khi create_payment_url = true)',
    enum: PaymentMethod,
    example: PaymentMethod.VNPAY,
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  payment_method_choice?: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Loại thanh toán (chỉ cần khi create_payment_url = true)',
    enum: ['full', 'deposit', 'remaining'],
    example: 'full',
    default: 'full',
  })
  @IsOptional()
  @IsEnum(['full', 'deposit', 'remaining'])
  payment_type?: 'full' | 'deposit' | 'remaining' = 'full';

  @ApiPropertyOptional({
    description: 'Mô tả thanh toán (chỉ cần khi create_payment_url = true)',
    example: 'Thanh toán booking khách sạn',
  })
  @IsOptional()
  @IsString()
  payment_description?: string;

  @ApiPropertyOptional({
    description:
      'URL trở về khi thanh toán thành công (chỉ cần khi create_payment_url = true)',
    example: 'http://localhost:5173/admin/bookings/payment-success',
  })
  @IsOptional()
  @IsString()
  payment_return_url?: string;

  @ApiPropertyOptional({
    description:
      'URL nhận thông báo IPN (chỉ cần khi create_payment_url = true)',
    example: 'https://api.example.com/bookings/payment/notify',
  })
  @IsOptional()
  @IsString()
  payment_notify_url?: string;

  @ApiPropertyOptional({
    description:
      'Số tiền thanh toán cụ thể (chỉ cần khi create_payment_url = true, nếu không muốn dùng tự động)',
    example: 2500000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  payment_amount?: number;
}
