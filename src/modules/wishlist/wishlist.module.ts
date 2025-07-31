import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  WishlistController,
  AdminWishlistController,
} from './wishlist.controller';
import { WishlistService } from './wishlist.service';
import { WishlistRepo } from './wishlist.repo';
import { Wishlist, WishlistSchema } from './schemas/wishlist.schema';
import { Listing, ListingSchema } from '../listing/schemas/listing.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Wishlist.name, schema: WishlistSchema },
      { name: Listing.name, schema: ListingSchema },
    ]),
  ],
  controllers: [WishlistController, AdminWishlistController],
  providers: [WishlistService, WishlistRepo],
  exports: [WishlistService, WishlistRepo],
})
export class WishlistModule {}
