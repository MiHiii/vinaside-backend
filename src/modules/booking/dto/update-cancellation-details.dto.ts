import { IsOptional, IsString } from 'class-validator';

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
}
