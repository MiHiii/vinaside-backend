import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsRepo } from './reviews.repo';
import { Review, ReviewSchema } from './schemas/review.schema';
import { PropertyModule } from '../properties/property.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Review.name, schema: ReviewSchema }]),
    PropertyModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewsRepo],
  exports: [ReviewsService, ReviewsRepo],
})
export class ReviewsModule {}
