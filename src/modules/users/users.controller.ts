import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  Post,
  Body,
  Put,
  Patch,
  HttpCode,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles } from 'src/decorators/roles.decorator';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { QueryUserDto } from './dto/query-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';

interface ApiResponse<T> {
  data?: T;
  success?: boolean;
}

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('admin')
  @Get()
  @ResponseMessage('Lấy danh sách người dùng thành công.')
  findAll(@Query() query: QueryUserDto): Promise<any> {
    return this.usersService.findAllWithFilters(query);
  }

  @Roles('admin')
  @Get('count/total')
  @ResponseMessage('Đếm số lượng người dùng thành công.')
  count(): Promise<ApiResponse<{ count: number }>> {
    return this.usersService.count();
  }

  @Roles('admin')
  @Get(':id')
  @ResponseMessage('Lấy thông tin người dùng thành công.')
  findOne(@Param('id') id: string): Promise<ApiResponse<any>> {
    return this.usersService.findOne(id);
  }

  @Roles('admin')
  @Post()
  @ResponseMessage('Tạo người dùng thành công.')
  create(@Body() createUserDto: CreateUserDto): Promise<ApiResponse<any>> {
    return this.usersService.createUser(createUserDto);
  }

  @Roles('admin')
  @Put(':id')
  @ResponseMessage('Cập nhật toàn bộ thông tin người dùng thành công.')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<ApiResponse<any>> {
    return this.usersService.updateFull(id, updateUserDto);
  }

  @Roles('admin')
  @Patch(':id')
  @ResponseMessage('Cập nhật một phần thông tin người dùng thành công.')
  patch(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<ApiResponse<any>> {
    return this.usersService.updatePartial(id, updateUserDto);
  }

  @Roles('admin')
  @Patch(':id/toggle-status')
  @ResponseMessage('Thay đổi trạng thái người dùng thành công.')
  toggleStatus(@Param('id') id: string): Promise<ApiResponse<any>> {
    return this.usersService.toggleStatus(id);
  }

  @Roles('admin')
  @Delete(':id')
  @HttpCode(204)
  @ResponseMessage('Xóa người dùng thành công.')
  delete(@Param('id') id: string): Promise<ApiResponse<any>> {
    return this.usersService.delete(id);
  }

  // =============== AVATAR ENDPOINTS ===============

  @Roles('guest', 'staff', 'admin')
  @Patch(':id/avatar')
  @ResponseMessage('Cập nhật avatar thành công.')
  updateAvatar(
    @Param('id') id: string,
    @Body() updateAvatarDto: UpdateAvatarDto,
  ) {
    return this.usersService.updateAvatar(id, updateAvatarDto.avatar_url);
  }

  @Roles('guest', 'staff', 'admin')
  @Get(':id/avatar')
  @ResponseMessage('Lấy thông tin avatar thành công.')
  getAvatar(@Param('id') id: string) {
    return this.usersService.getUserAvatar(id);
  }

  @Roles('guest', 'staff', 'admin')
  @Delete(':id/avatar')
  @ResponseMessage('Xóa avatar thành công.')
  removeAvatar(@Param('id') id: string) {
    return this.usersService.removeAvatar(id);
  }

  @Roles('guest', 'staff', 'admin')
  @Patch('profile/avatar')
  @ResponseMessage('Cập nhật avatar cá nhân thành công.')
  updateMyAvatar(
    @Request() req: RequestWithUser,
    @Body() updateAvatarDto: UpdateAvatarDto,
  ) {
    return this.usersService.updateAvatar(
      req.user._id,
      updateAvatarDto.avatar_url,
    );
  }

  @Roles('guest', 'staff', 'admin')
  @Get('profile/avatar')
  @ResponseMessage('Lấy avatar cá nhân thành công.')
  getMyAvatar(@Request() req: RequestWithUser) {
    return this.usersService.getUserAvatar(req.user._id);
  }

  @Roles('guest', 'staff', 'admin')
  @Delete('profile/avatar')
  @ResponseMessage('Xóa avatar cá nhân thành công.')
  removeMyAvatar(@Request() req: RequestWithUser) {
    return this.usersService.removeAvatar(req.user._id);
  }
}
