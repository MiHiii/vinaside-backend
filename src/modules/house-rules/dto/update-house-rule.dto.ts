import { PartialType } from '@nestjs/mapped-types';
import { CreateHouseRuleDto } from './create-house-rule.dto';

export class UpdateHouseRuleDto extends PartialType(CreateHouseRuleDto) {}