import { PartialType } from '@nestjs/swagger';
import { CreateSafetyFeatureDto } from './create-safety_feature.dto';

export class UpdateSafetyFeatureDto extends PartialType(
  CreateSafetyFeatureDto,
) {}
