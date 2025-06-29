import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsObject,
  Min,
  IsMongoId,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TransactionType,
  TransactionDirection,
  PaymentMethod,
  PaymentProvider,
  ReferenceType,
} from '../schemas/transaction.schema';

export class CreateTransactionDto {
  @ApiProperty({
    description: 'Type of transaction',
    enum: TransactionType,
    example: TransactionType.PAYMENT,
  })
  @IsEnum(TransactionType)
  @IsNotEmpty()
  type: TransactionType;

  @ApiPropertyOptional({
    description: 'Property ID associated with this transaction',
    example: '507f1f77bcf86cd799439012',
  })
  @IsMongoId()
  @IsOptional()
  propertyId?: string;

  @ApiProperty({
    description: 'Reference ID to booking, payout, etc.',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  @IsNotEmpty()
  reference_id: string;

  @ApiProperty({
    description: 'Type of reference object',
    enum: ReferenceType,
    example: ReferenceType.BOOKING,
  })
  @IsEnum(ReferenceType)
  @IsNotEmpty()
  reference_type: ReferenceType;

  @ApiProperty({
    description: 'User ID performing the transaction',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  @IsNotEmpty()
  user_id: string;

  @ApiProperty({
    description: 'Direction of money flow',
    enum: TransactionDirection,
    example: TransactionDirection.IN,
  })
  @IsEnum(TransactionDirection)
  @IsNotEmpty()
  direction: TransactionDirection;

  @ApiProperty({
    description: 'Transaction amount',
    example: 1500000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  amount: number;

  @ApiPropertyOptional({
    description: 'Currency code',
    example: 'VND',
    default: 'VND',
  })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({
    description: 'Payment method used',
    enum: PaymentMethod,
    example: PaymentMethod.MOMO,
  })
  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  method: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Internal note or description',
    example: 'Payment for booking #12345',
  })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({
    description: 'Payment provider',
    enum: PaymentProvider,
    example: PaymentProvider.MOMO,
  })
  @IsEnum(PaymentProvider)
  @IsOptional()
  provider?: PaymentProvider;

  @ApiPropertyOptional({
    description: 'Transaction ID from payment provider',
    example: 'MOMO_TXN_123456789',
  })
  @IsString()
  @IsOptional()
  provider_transaction_id?: string;

  @ApiPropertyOptional({
    description: 'Order ID sent to payment provider',
    example: 'VINASIDE_ORDER_123456',
  })
  @IsString()
  @IsOptional()
  provider_order_id?: string;

  @ApiPropertyOptional({
    description: 'Raw response data from payment provider',
    example: { status: 'success', message: 'Payment completed' },
  })
  @IsObject()
  @IsOptional()
  raw_response?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'User ID who created this transaction',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  @IsOptional()
  created_by?: string;
}
