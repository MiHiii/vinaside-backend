import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  IsArray,
  IsBoolean,
} from 'class-validator';

export class AdminCreateUserDto {
  @IsNotEmpty()
  @IsString()
  @Length(2, 100)
  name: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 100, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password: string;

  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  avatar_url?: string;

  @IsOptional()
  @IsEnum(['guest', 'staff', 'admin'], {
    message: 'Vai trò phải là một trong các giá trị: guest, staff, admin',
  })
  role?: string = 'staff'; // Default to staff for admin-created users

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customRoles?: string[] = [];

  @IsOptional()
  @IsEnum(['vi', 'en'], {
    message: 'Ngôn ngữ phải là một trong các giá trị: vi, en',
  })
  language?: string = 'vi';

  @IsOptional()
  @IsBoolean()
  is_verified?: boolean = true; // Admin-created users are auto-verified
}
