import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsRepo } from './reviews.repo';
import { Review, ReviewSchema } from './schemas/review.schema';
import { PropertyModule } from '../properties/property.module';
import { ListingModule } from '../listing/listing.module';
import { Listing, ListingSchema } from '../listing/schemas/listing.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Review.name, schema: ReviewSchema },
      { name: Listing.name, schema: ListingSchema },
    ]),
    PropertyModule,
    ListingModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewsRepo],
  exports: [ReviewsService, ReviewsRepo],
})
export class ReviewsModule {}
