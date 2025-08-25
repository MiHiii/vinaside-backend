import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../../transactions/schemas/transaction.schema';
import { BookingResponseDto } from './booking-response.dto';

export class PaymentUrlInfo {
  @ApiProperty({
    description: 'Trạng thái tạo payment',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Phương thức thanh toán',
    enum: PaymentMethod,
    example: PaymentMethod.VNPAY,
  })
  paymentMethod: PaymentMethod;

  @ApiProperty({
    description: 'URL thanh toán',
    example: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?...',
  })
  paymentUrl: string;

  @ApiProperty({
    description: 'Order ID',
    example: 'VINASIDE_20241213_123456',
  })
  orderId: string;

  @ApiProperty({
    description: 'Số tiền thanh toán',
    example: 2500000,
  })
  amount: number;

  @ApiProperty({
    description: 'Thông báo',
    example: 'Tạo payment URL thành công',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Thời gian hết hạn',
    example: '2024-12-13T16:00:00Z',
  })
  expiresAt?: string;

  @ApiProperty({
    description: 'Thời gian tạo',
    example: '2024-12-13T15:00:00Z',
  })
  createdAt: string;
}

export class StaffBookingResponseDto {
  @ApiProperty({
    description: 'Thông tin booking đã được tạo',
    type: BookingResponseDto,
  })
  booking: BookingResponseDto;

  @ApiPropertyOptional({
    description: 'Thông tin payment URL (chỉ có khi create_payment_url = true)',
    type: PaymentUrlInfo,
  })
  paymentUrl?: PaymentUrlInfo;
}
