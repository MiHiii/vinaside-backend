import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

// Loại bỏ các trường không được phép cập nhật: email và password_hash
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['email', 'password_hash'] as const),
) {
  @IsOptional()
  @IsString({ message: 'Tên phải là một chuỗi hợp lệ' })
  @Length(2, 100, {
    message: 'Tên phải có độ dài từ $constraint1 đến $constraint2 ký tự',
  })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Số điện thoại phải là một chuỗi hợp lệ' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'Đường dẫn avatar phải là một chuỗi hợp lệ' })
  avatar_url?: string;

  @IsOptional()
  @IsString({ message: 'Vai trò phải là một chuỗi hợp lệ' })
  role?: string;

  @IsOptional()
  @IsString({ message: 'Ngôn ngữ phải là một chuỗi hợp lệ' })
  language?: string;

  @IsOptional()
  is_verified?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'Trạng thái xóa phải là giá trị boolean' })
  isDeleted?: boolean;
}
