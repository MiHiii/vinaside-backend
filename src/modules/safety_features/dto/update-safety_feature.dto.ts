import { PartialType } from '@nestjs/mapped-types';
import { CreateSafetyFeatureDto } from './create-safety_feature.dto';

export class UpdateSafetyFeatureDto extends PartialType(
  CreateSafetyFeatureDto,
) {}
