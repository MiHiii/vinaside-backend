import { IsOptional, IsString, IsArray, IsNumber, Min } from 'class-validator';

export class UpdateCancellationDetailsDto {
  @IsString()
  @IsOptional()
  accountName?: string;

  @IsString()
  @IsOptional()
  bankName?: string;

  @IsString()
  @IsOptional()
  accountNumber?: string;

  @IsString()
  @IsOptional()
  cancellationReason?: string;

  @IsString()
  @IsOptional()
  refundMethod?: string;

  @IsString()
  @IsOptional()
  refundNote?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  refundImageUrls?: string[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  refundAmount?: number;
}

// DTO riêng cho việc hoàn tiền với ảnh minh chứng
export class RefundBookingDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  refundAmount?: number;

  @IsString()
  @IsOptional()
  accountName?: string;

  @IsString()
  @IsOptional()
  bankName?: string;

  @IsString()
  @IsOptional()
  accountNumber?: string;

  @IsString()
  @IsOptional()
  refundMethod?: string;

  @IsString()
  @IsOptional()
  refundNote?: string;

  @IsArray()
  @IsString({ each: true })
  refundImageUrls: string[]; // Bắt buộc phải có ảnh minh chứng
}
