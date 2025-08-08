import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsUrl,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVNPayPaymentDto {
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
  orderDescription?: string;

  @ApiProperty({
    description: 'URL trở về khi thanh toán thành công',
    example: 'http://localhost:5173/booking/payment-success',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  returnUrl?: string;
}

export class VNPayPaymentResponseDto {
  @ApiProperty({
    description: 'URL thanh toán VNPay',
    example: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?...',
  })
  paymentUrl: string;

  @ApiProperty({
    description: 'Mã giao dịch (Order ID)',
    example: '507f1f77bcf86cd799439011_1703123456789',
  })
  orderId: string;

  @ApiProperty({
    description: 'Số tiền thanh toán (VND)',
    example: 2500000,
  })
  amount: number;

  @ApiProperty({
    description: 'Thời gian tạo giao dịch',
    example: '20231220141056',
  })
  createDate: string;

  @ApiProperty({
    description: 'Thời gian hết hạn thanh toán',
    example: '20231220144056',
  })
  expireDate: string;
}

export class VNPayCallbackDto {
  @ApiProperty({ description: 'Mã website của merchant' })
  @IsString()
  vnp_TmnCode: string;

  @ApiProperty({ description: 'Số tiền thanh toán (đã nhân 100)' })
  @IsString()
  vnp_Amount: string;

  @ApiProperty({ description: 'Mã ngân hàng thanh toán' })
  @IsString()
  vnp_BankCode: string;

  @ApiProperty({ description: 'Thông tin mô tả giao dịch' })
  @IsString()
  vnp_OrderInfo: string;

  @ApiProperty({ description: 'Mã giao dịch tại hệ thống của merchant' })
  @IsString()
  vnp_TxnRef: string;

  @ApiProperty({ description: 'Mã phản hồi kết quả thanh toán' })
  @IsString()
  vnp_ResponseCode: string;

  @ApiProperty({ description: 'Mã giao dịch tại VNPAY' })
  @IsString()
  vnp_TransactionNo: string;

  @ApiProperty({ description: 'Mã giao dịch thanh toán tại Ngân hàng' })
  @IsString()
  vnp_BankTranNo: string;

  @ApiProperty({ description: 'Loại tài khoản/thẻ khách hàng sử dụng' })
  @IsString()
  vnp_CardType: string;

  @ApiProperty({ description: 'Thời gian thanh toán' })
  @IsString()
  vnp_PayDate: string;

  @ApiProperty({ description: 'Chữ ký điện tử của giao dịch' })
  @IsString()
  vnp_SecureHash: string;

  @ApiProperty({ description: 'Command', example: 'pay', required: false })
  @IsOptional()
  @IsString()
  vnp_Command?: string;

  @ApiProperty({ description: 'Version', example: '2.1.0', required: false })
  @IsOptional()
  @IsString()
  vnp_Version?: string;

  @ApiProperty({
    description: 'Currency code',
    example: 'VND',
    required: false,
  })
  @IsOptional()
  @IsString()
  vnp_CurrCode?: string;

  @ApiProperty({ description: 'Locale', example: 'vn', required: false })
  @IsOptional()
  @IsString()
  vnp_Locale?: string;

  @ApiProperty({ description: 'Thời gian khởi tạo giao dịch', required: false })
  @IsOptional()
  @IsString()
  vnp_CreateDate?: string;
}

export class VNPayVerificationResponseDto {
  @ApiProperty({
    description: 'Trạng thái xác thực thanh toán',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Mã phản hồi từ VNPay',
    example: '00',
  })
  responseCode: string;

  @ApiProperty({
    description: 'Thông báo kết quả',
    example: 'Giao dịch thành công',
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
    description: 'Mã giao dịch tại VNPay',
    example: '14073556',
  })
  transactionNo: string;

  @ApiProperty({
    description: 'Mã giao dịch tại ngân hàng',
    example: 'VCB20231220141056',
  })
  bankTranNo: string;

  @ApiProperty({
    description: 'Loại thẻ/tài khoản sử dụng',
    example: 'ATM',
  })
  cardType: string;

  @ApiProperty({
    description: 'Thời gian thanh toán thành công',
    example: '2023-12-20T07:10:56.000Z',
  })
  payDate: Date;
}

export class VNPayRefundDto {
  @ApiProperty({
    description: 'ID của booking cần hoàn tiền',
    example: '507f1f77bcf86cd799439011',
  })
  @IsNotEmpty()
  @IsString()
  bookingId: string;

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
  reason: string;
}

export class VNPayRefundResponseDto {
  @ApiProperty({
    description: 'Trạng thái hoàn tiền',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Mã phản hồi từ VNPay',
    example: '00',
  })
  responseCode: string;

  @ApiProperty({
    description: 'Thông báo kết quả',
    example: 'Hoàn tiền thành công',
  })
  message: string;

  @ApiProperty({
    description: 'Mã giao dịch hoàn tiền',
    example: 'REFUND_507f1f77bcf86cd799439011_1703123456789',
  })
  refundTxnRef: string;

  @ApiProperty({
    description: 'Số tiền hoàn lại',
    example: 2500000,
  })
  refundAmount: number;
}
