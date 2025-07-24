import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @IsString({ message: 'Tên phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tên không được để trống' })
  name: string;

  @IsNotEmpty({ message: 'Email không được để trống' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự' })
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password: string;

  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  @Matches(/^\d{9,12}$/, {
    message: 'Số điện thoại không hợp lệ (9–12 chữ số)',
  })
  phone: string;
}
