import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { HouseRulesService } from './houserules.service';
import { HouseRulesController } from './house-rules.controller';
import { HouseRulesRepo } from './house-rules.repo';
import { HouseRule, HouseRuleSchema } from './schemas/house-rule.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HouseRule.name, schema: HouseRuleSchema },
    ]),
  ],
  controllers: [HouseRulesController],
  providers: [HouseRulesService, HouseRulesRepo],
  exports: [HouseRulesService],
})
export class HouseRulesModule {}
