import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';
import { WishlistRepo } from './wishlist.repo';
import { WishlistList, WishlistListSchema } from './schemas/wishlist-list.schema';
import { WishlistItem, WishlistItemSchema } from './schemas/wishlist-item.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WishlistList.name, schema: WishlistListSchema },
      { name: WishlistItem.name, schema: WishlistItemSchema },
    ]),
  ],
  controllers: [WishlistController],
  providers: [WishlistService, WishlistRepo],
  exports: [WishlistService, WishlistRepo],
})
export class WishlistModule {}
