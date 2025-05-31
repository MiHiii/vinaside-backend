import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendMailDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email người nhận là bắt buộc' })
  to: string;

  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề email là bắt buộc' })
  subject: string;

  @IsString()
  @IsNotEmpty({ message: 'Template email là bắt buộc' })
  template: string;

  @IsOptional()
  context?: Record<string, any>;
}
