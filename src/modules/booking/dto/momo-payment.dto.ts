import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsUrl,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMoMoPaymentDto {
  @ApiProperty({
    description: 'ID của booking cần thanh toán',
    example: '507f1f77bcf86cd799439011',
  })
  @IsNotEmpty()
  @IsString()
  bookingId: string;

  @ApiProperty({
    description: 'Mô tả giao dịch',
    example: 'Thanh toan dat phong khach san',
    required: false,
  })
  @IsOptional()
  @IsString()
  orderInfo?: string;

  @ApiProperty({
    description: 'URL trở về khi thanh toán thành công',
    example: 'http://localhost:5173/booking/payment-success',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  returnUrl?: string;

  @ApiProperty({
    description: 'URL nhận thông báo từ MoMo',
    example: 'https://api.example.com/bookings/payment/momo/notify',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  notifyUrl?: string;
}

export class MoMoPaymentResponseDto {
  @ApiProperty({
    description: 'URL thanh toán MoMo',
    example: 'https://payment.momo.vn/v2/gateway/pay?t=...',
  })
  payUrl: string;

  @ApiProperty({
    description: 'Deeplink cho MoMo app',
    example: 'momo://app?action=payWithAppInApp&...',
  })
  deeplink: string;

  @ApiProperty({
    description: 'QR Code URL',
    example: 'https://payment.momo.vn/v2/gateway/qr?t=...',
  })
  qrCodeUrl: string;

  @ApiProperty({
    description: 'Mã giao dịch (Order ID)',
    example: '507f1f77bcf86cd799439011_1703123456789',
  })
  orderId: string;

  @ApiProperty({
    description: 'Request ID từ MoMo',
    example: '1703123456789',
  })
  requestId: string;

  @ApiProperty({
    description: 'Số tiền thanh toán (VND)',
    example: 2500000,
  })
  amount: number;

  @ApiProperty({
    description: 'Thông báo kết quả',
    example: 'Tạo giao dịch thành công',
  })
  message: string;
}

export class MoMoCallbackDto {
  @ApiProperty({ description: 'Partner Code của merchant' })
  @IsString()
  partnerCode: string;

  @ApiProperty({ description: 'Mã giao dịch tại hệ thống merchant' })
  @IsString()
  orderId: string;

  @ApiProperty({ description: 'Request ID của giao dịch' })
  @IsString()
  requestId: string;

  @ApiProperty({ description: 'Số tiền giao dịch' })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: 'Thông tin đơn hàng' })
  @IsString()
  orderInfo: string;

  @ApiProperty({ description: 'Loại giao dịch' })
  @IsString()
  orderType: string;

  @ApiProperty({ description: 'Mã giao dịch tại MoMo' })
  @IsString()
  transId: string;

  @ApiProperty({ description: 'Mã kết quả giao dịch' })
  @IsNumber()
  resultCode: number;

  @ApiProperty({ description: 'Thông báo kết quả' })
  @IsString()
  message: string;

  @ApiProperty({ description: 'Loại thanh toán' })
  @IsString()
  payType: string;

  @ApiProperty({ description: 'Thời gian phản hồi' })
  @IsNumber()
  responseTime: number;

  @ApiProperty({ description: 'Thông tin thêm' })
  @IsOptional()
  @IsString()
  extraData?: string;

  @ApiProperty({ description: 'Chữ ký xác thực' })
  @IsString()
  signature: string;
}

export class MoMoVerificationResponseDto {
  @ApiProperty({
    description: 'Trạng thái xác thực thanh toán',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Mã kết quả từ MoMo',
    example: 0,
  })
  resultCode: number;

  @ApiProperty({
    description: 'Thông báo kết quả',
    example: 'Successful',
  })
  message: string;

  @ApiProperty({
    description: 'ID booking được cập nhật',
    example: '507f1f77bcf86cd799439011',
  })
  bookingId: string;

  @ApiProperty({
    description: 'Số tiền thanh toán',
    example: 2500000,
  })
  amount: number;

  @ApiProperty({
    description: 'Mã giao dịch tại MoMo',
    example: '2518712364',
  })
  transId: string;

  @ApiProperty({
    description: 'Request ID',
    example: '1703123456789',
  })
  requestId: string;

  @ApiProperty({
    description: 'Loại thanh toán',
    example: 'napas',
  })
  payType: string;

  @ApiProperty({
    description: 'Thời gian thanh toán thành công',
    example: '2023-12-20T07:10:56.000Z',
  })
  responseTime: Date;
}

export class MoMoRefundDto {
  @ApiProperty({
    description: 'ID của booking cần hoàn tiền',
    example: '507f1f77bcf86cd799439011',
  })
  @IsNotEmpty()
  @IsString()
  bookingId: string;

  @ApiProperty({
    description: 'Mã giao dịch gốc tại MoMo',
    example: '2518712364',
  })
  @IsNotEmpty()
  @IsString()
  transId: string;

  @ApiProperty({
    description: 'Số tiền hoàn lại (VND)',
    example: 2500000,
  })
  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @ApiProperty({
    description: 'Lý do hoàn tiền',
    example: 'Khách hàng hủy booking',
  })
  @IsNotEmpty()
  @IsString()
  description: string;
}

export class MoMoRefundResponseDto {
  @ApiProperty({
    description: 'Trạng thái hoàn tiền',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Mã kết quả từ MoMo',
    example: 0,
  })
  resultCode: number;

  @ApiProperty({
    description: 'Thông báo kết quả',
    example: 'Hoàn tiền thành công',
  })
  message: string;

  @ApiProperty({
    description: 'Mã giao dịch hoàn tiền',
    example: 'REFUND_507f1f77bcf86cd799439011_1703123456789',
  })
  refundId: string;

  @ApiProperty({
    description: 'Số tiền hoàn lại',
    example: 2500000,
  })
  refundAmount: number;

  @ApiProperty({
    description: 'Mã giao dịch hoàn tiền tại MoMo',
    example: '2518712365',
  })
  refundTransId: string;
}
