import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class CreateAmenityDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  icon_url: string;

  @IsString()
  room_id: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
