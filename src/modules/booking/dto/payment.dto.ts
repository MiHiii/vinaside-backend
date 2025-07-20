import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUrl,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '../../transactions/schemas/transaction.schema';

export class CreatePaymentDto {
  @ApiProperty({
    description: 'ID của booking cần thanh toán (sẽ được lấy từ URL params)',
    example: '507f1f77bcf86cd799439011',
    required: false,
  })
  @IsOptional()
  @IsString()
  bookingId?: string;

  @ApiProperty({
    description: 'Phương thức thanh toán',
    enum: PaymentMethod,
    example: PaymentMethod.VNPAY,
  })
  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({
    description: 'Mô tả giao dịch',
    example: 'Thanh toan dat phong khach san',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'URL trở về khi thanh toán thành công',
    example: 'http://localhost:5173/booking/payment-success',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  returnUrl?: string;

  @ApiProperty({
    description: 'URL nhận thông báo IPN',
    example: 'https://api.example.com/bookings/payment/notify',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  notifyUrl?: string;
}

export class PaymentResponseDto {
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
    description: 'URL thanh toán (cho web)',
    example: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?...',
    required: false,
  })
  paymentUrl?: string;

  @ApiProperty({
    description: 'Deeplink (cho mobile app)',
    example: 'momo://app?action=payWithAppInApp&...',
    required: false,
  })
  deeplink?: string;

  @ApiProperty({
    description: 'QR Code URL',
    example: 'https://payment.momo.vn/v2/gateway/qr?t=...',
    required: false,
  })
  qrCodeUrl?: string;

  @ApiProperty({
    description: 'Mã đơn hàng',
    example: '507f1f77bcf86cd799439011_1703123456789',
  })
  orderId: string;

  @ApiProperty({
    description: 'Số tiền thanh toán (VND)',
    example: 2500000,
  })
  amount: number;

  @ApiProperty({
    description: 'Thông báo',
    example: 'Tạo giao dịch thành công',
  })
  message: string;

  @ApiProperty({
    description: 'Thời gian hết hạn',
    example: '2023-12-20T07:25:56.000Z',
    required: false,
  })
  expiresAt?: Date;

  @ApiProperty({
    description: 'Thời gian tạo',
    example: '2023-12-20T07:10:56.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Metadata từ gateway',
    required: false,
  })
  metadata?: Record<string, any>;
}

export class PaymentVerificationDto {
  @ApiProperty({
    description: 'Trạng thái xác thực',
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
    description: 'ID booking',
    example: '507f1f77bcf86cd799439011',
  })
  bookingId: string;

  @ApiProperty({
    description: 'Mã đơn hàng',
    example: '507f1f77bcf86cd799439011_1703123456789',
  })
  orderId: string;

  @ApiProperty({
    description: 'Số tiền thanh toán',
    example: 2500000,
  })
  amount: number;

  @ApiProperty({
    description: 'Mã giao dịch tại hệ thống',
    example: 'TXN_123456789',
  })
  transactionId: string;

  @ApiProperty({
    description: 'Mã giao dịch tại gateway',
    example: '14073556',
    required: false,
  })
  gatewayTransactionId?: string;

  @ApiProperty({
    description: 'Thời gian thanh toán',
    example: '2023-12-20T07:10:56.000Z',
    required: false,
  })
  paidAt?: Date;

  @ApiProperty({
    description: 'Thông báo kết quả',
    example: 'Giao dịch thành công',
  })
  message: string;

  @ApiProperty({
    description: 'Metadata từ gateway',
    required: false,
  })
  metadata?: Record<string, any>;
}

export class PaymentStatusDto {
  @ApiProperty({
    description: 'ID booking',
    example: '507f1f77bcf86cd799439011',
  })
  bookingId: string;

  @ApiProperty({
    description: 'Phương thức thanh toán',
    enum: PaymentMethod,
    example: PaymentMethod.VNPAY,
    required: false,
  })
  paymentMethod?: PaymentMethod;

  @ApiProperty({
    description: 'Trạng thái thanh toán từ booking',
    example: 'paid',
  })
  paymentStatus: string;

  @ApiProperty({
    description: 'Số tiền',
    example: 2500000,
  })
  amount: number;

  @ApiProperty({
    description: 'Mã giao dịch gateway',
    required: false,
  })
  gatewayTransactionId?: string;

  @ApiProperty({
    description: 'Thời gian thanh toán',
    required: false,
  })
  paidAt?: Date;

  @ApiProperty({
    description: 'Chi tiết gateway cụ thể',
    required: false,
  })
  gatewayDetails?: Record<string, any>;
}
