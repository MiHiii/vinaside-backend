import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionStatus } from '../schemas/transaction.schema';
import { ChangedBy } from '../schemas/transaction-log.schema';

export class UpdateTransactionStatusDto {
  @ApiProperty({
    description: 'New transaction status',
    enum: TransactionStatus,
    example: TransactionStatus.SUCCESS,
  })
  @IsEnum(TransactionStatus)
  @IsNotEmpty()
  status: TransactionStatus;

  @ApiProperty({
    description: 'Who changed the status',
    enum: ChangedBy,
    example: ChangedBy.SYSTEM,
  })
  @IsEnum(ChangedBy)
  @IsNotEmpty()
  changed_by: ChangedBy;

  @ApiPropertyOptional({
    description: 'Note explaining the status change',
    example: 'Payment confirmed by Momo webhook',
  })
  @IsString()
  @IsOptional()
  note?: string;
}
