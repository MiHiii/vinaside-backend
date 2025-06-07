import { IsString, IsOptional } from 'class-validator';

export class CreateSafetyFeatureDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  icon_url: string;

  @IsString()
  room_id: string;
}
