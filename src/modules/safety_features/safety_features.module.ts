import { Module } from '@nestjs/common';
import { SafetyFeaturesService } from './safety_features.service';
import { SafetyFeaturesController } from './safety_features.controller';
import { SafetyFeaturesRepo } from './safety_features.repo';
import { MongooseModule } from '@nestjs/mongoose';
import {
  SafetyFeature,
  SafetyFeatureSchema,
} from './schemas/safety_feature.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SafetyFeature.name, schema: SafetyFeatureSchema },
    ]),
  ],
  controllers: [SafetyFeaturesController],
  providers: [SafetyFeaturesService, SafetyFeaturesRepo],
})
export class SafetyFeaturesModule {}
