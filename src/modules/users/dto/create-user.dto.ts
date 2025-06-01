import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  @Length(2, 100)
  name: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password_hash: string;

  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  avatar_url?: string;

  @IsOptional()
  @IsEnum(['guest', 'host', 'admin'], {
    message: 'Vai trò phải là một trong các giá trị: guest, host, admin',
  })
  role?: string = 'guest';

  @IsOptional()
  @IsEnum(['vi', 'en'], {
    message: 'Ngôn ngữ phải là một trong các giá trị: vi, en',
  })
  language?: string = 'vi';

  @IsOptional()
  is_verified?: boolean = false;
}
