import { IsString, IsUrl, IsNotEmpty } from 'class-validator';

export class UpdateAvatarDto {
  @IsString()
  @IsNotEmpty()
  @IsUrl({}, { message: 'avatar_url phải là URL hợp lệ' })
  avatar_url: string;
}
