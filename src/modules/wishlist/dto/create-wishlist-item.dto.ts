import { IsNotEmpty, IsMongoId } from 'class-validator';

export class CreateWishlistItemDto {
  @IsMongoId()
  @IsNotEmpty()
  wishlist_id: string;

  @IsMongoId()
  @IsNotEmpty()
  room_id: string;
}
