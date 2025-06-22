import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { CreateWishlistListDto } from './dto/create-wishlist-list.dto';
import { UpdateWishlistListDto } from './dto/update-wishlist-list.dto';
import { CreateWishlistItemDto } from './dto/create-wishlist-item.dto';
import { QueryWishlistDto } from './dto/query-wishlist.dto';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { Roles } from 'src/decorators/roles.decorator';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('wishlists')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  // =========================== WISHLIST LIST ENDPOINTS ===========================

  @Post()
  @Roles('user', 'host', 'admin')
  @ResponseMessage('Tạo danh sách yêu thích thành công')
  createList(
    @Body() createWishlistListDto: CreateWishlistListDto,
    @Request() req: RequestWithUser,
  ) {
    return this.wishlistService.createList(createWishlistListDto, req.user);
  }

  @Get()
  @Roles('user', 'host', 'admin')
  @ResponseMessage('Lấy danh sách yêu thích thành công')
  getMyLists(
    @Query() queryDto: QueryWishlistDto,
    @Request() req: RequestWithUser,
  ) {
    return this.wishlistService.getMyLists(req.user, queryDto);
  }

  @Get(':id')
  @Roles('user', 'host', 'admin')
  @ResponseMessage('Lấy thông tin danh sách yêu thích thành công')
  getListById(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.wishlistService.getListById(id, req.user);
  }

  @Patch(':id')
  @Roles('user', 'host', 'admin')
  @ResponseMessage('Cập nhật danh sách yêu thích thành công')
  updateList(
    @Param('id') id: string,
    @Body() updateWishlistListDto: UpdateWishlistListDto,
    @Request() req: RequestWithUser,
  ) {
    return this.wishlistService.updateList(id, updateWishlistListDto, req.user);
  }

  @Delete(':id')
  @Roles('user', 'host', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseMessage('Xóa danh sách yêu thích thành công')
  deleteList(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.wishlistService.deleteList(id, req.user);
  }

  // =========================== WISHLIST ITEM ENDPOINTS ===========================

  @Post('items')
  @Roles('user', 'host', 'admin')
  @ResponseMessage('Thêm phòng vào danh sách yêu thích thành công')
  addItemToList(
    @Body() createWishlistItemDto: CreateWishlistItemDto,
    @Request() req: RequestWithUser,
  ) {
    return this.wishlistService.addItemToList(createWishlistItemDto, req.user);
  }

  @Get(':wishlistId/items')
  @Roles('user', 'host', 'admin')
  @ResponseMessage('Lấy danh sách phòng yêu thích thành công')
  getItemsInList(
    @Param('wishlistId') wishlistId: string,
    @Query() queryDto: QueryWishlistDto,
    @Request() req: RequestWithUser,
  ) {
    return this.wishlistService.getItemsInList(wishlistId, req.user, queryDto);
  }

  @Delete(':wishlistId/items/:roomId')
  @Roles('user', 'host', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseMessage('Xóa phòng khỏi danh sách yêu thích thành công')
  removeItemFromList(
    @Param('wishlistId') wishlistId: string,
    @Param('roomId') roomId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.wishlistService.removeItemFromList(
      wishlistId,
      roomId,
      req.user,
    );
  }

  @Get(':wishlistId/items/:roomId/check')
  @Roles('user', 'host', 'admin')
  @ResponseMessage('Kiểm tra phòng trong danh sách yêu thích thành công')
  checkItemInList(
    @Param('wishlistId') wishlistId: string,
    @Param('roomId') roomId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.wishlistService.checkItemInList(wishlistId, roomId, req.user);
  }
}
