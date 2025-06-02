import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateHouseRuleDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon_url?: string;

  @IsOptional()
  @IsBoolean()
  default_checked?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
