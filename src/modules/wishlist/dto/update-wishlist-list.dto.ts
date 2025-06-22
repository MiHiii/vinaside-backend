import { PartialType } from '@nestjs/mapped-types';
import { CreateWishlistListDto } from './create-wishlist-list.dto';

export class UpdateWishlistListDto extends PartialType(CreateWishlistListDto) {}
