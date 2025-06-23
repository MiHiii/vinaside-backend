import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  WishlistController,
  AdminWishlistController,
} from './wishlist.controller';
import { WishlistService } from './wishlist.service';
import { WishlistRepo } from './wishlist.repo';
import { Wishlist, WishlistSchema } from './schemas/wishlist.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Wishlist.name, schema: WishlistSchema },
    ]),
  ],
  controllers: [WishlistController, AdminWishlistController],
  providers: [WishlistService, WishlistRepo],
  exports: [WishlistService, WishlistRepo],
})
export class WishlistModule {}
