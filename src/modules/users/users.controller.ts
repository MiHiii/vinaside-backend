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
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from 'src/decorators/roles.decorator';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { QueryUserDto } from './dto/query-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

interface ApiResponse<T> {
  data?: T;
  success?: boolean;
}

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('User Management')
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @RequirePermission('user.view')
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách người dùng' })
  @ApiResponse({ status: 200, description: 'Danh sách người dùng' })
  @ResponseMessage('Lấy danh sách người dùng thành công.')
  findAll(@Query() query: QueryUserDto): Promise<any> {
    return this.usersService.findAllWithFilters(query);
  }

  @RequirePermission('user.view')
  @Get('count/total')
  @ApiOperation({ summary: 'Đếm tổng số người dùng' })
  @ApiResponse({ status: 200, description: 'Số lượng người dùng' })
  @ResponseMessage('Đếm số lượng người dùng thành công.')
  count(): Promise<ApiResponse<{ count: number }>> {
    return this.usersService.count();
  }

  @RequirePermission('user.view')
  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin người dùng theo ID' })
  @ApiResponse({ status: 200, description: 'Thông tin người dùng' })
  @ResponseMessage('Lấy thông tin người dùng thành công.')
  findOne(@Param('id') id: string): Promise<ApiResponse<any>> {
    return this.usersService.findOne(id);
  }

  @RequirePermission('user.edit')
  @Post()
  @ApiOperation({ summary: 'Tạo người dùng mới' })
  @ApiResponse({ status: 201, description: 'Người dùng được tạo thành công' })
  @ResponseMessage('Tạo người dùng thành công.')
  create(@Body() createUserDto: CreateUserDto): Promise<ApiResponse<any>> {
    return this.usersService.createUser(createUserDto);
  }

  @RequirePermission('user.edit')
  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật toàn bộ thông tin người dùng' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin người dùng được cập nhật',
  })
  @ResponseMessage('Cập nhật toàn bộ thông tin người dùng thành công.')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<ApiResponse<any>> {
    return this.usersService.updateFull(id, updateUserDto);
  }

  @RequirePermission('user.edit')
  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật một phần thông tin người dùng' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin người dùng được cập nhật',
  })
  @ResponseMessage('Cập nhật một phần thông tin người dùng thành công.')
  patch(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<ApiResponse<any>> {
    return this.usersService.updatePartial(id, updateUserDto);
  }

  @RequirePermission('user.edit')
  @Patch(':id/toggle-status')
  @ApiOperation({ summary: 'Thay đổi trạng thái người dùng (active/inactive)' })
  @ApiResponse({
    status: 200,
    description: 'Trạng thái người dùng được thay đổi',
  })
  @ResponseMessage('Thay đổi trạng thái người dùng thành công.')
  toggleStatus(@Param('id') id: string): Promise<ApiResponse<any>> {
    return this.usersService.toggleStatus(id);
  }

  @RequirePermission('user.delete')
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Xóa người dùng' })
  @ApiResponse({ status: 204, description: 'Người dùng được xóa thành công' })
  @ResponseMessage('Xóa người dùng thành công.')
  delete(@Param('id') id: string): Promise<ApiResponse<any>> {
    return this.usersService.delete(id);
  }

  // =============== AVATAR ENDPOINTS ===============

  @Roles('guest', 'staff', 'admin')
  @Patch(':id/avatar')
  @ApiOperation({ summary: 'Cập nhật avatar người dùng' })
  @ApiResponse({ status: 200, description: 'Avatar được cập nhật thành công' })
  @ResponseMessage('Cập nhật avatar thành công.')
  updateAvatar(
    @Param('id') id: string,
    @Body() updateAvatarDto: UpdateAvatarDto,
  ) {
    return this.usersService.updateAvatar(id, updateAvatarDto.avatar_url);
  }

  @Roles('guest', 'staff', 'admin')
  @Get(':id/avatar')
  @ApiOperation({ summary: 'Lấy thông tin avatar người dùng' })
  @ApiResponse({ status: 200, description: 'Thông tin avatar' })
  @ResponseMessage('Lấy thông tin avatar thành công.')
  getAvatar(@Param('id') id: string) {
    return this.usersService.getUserAvatar(id);
  }

  @Roles('guest', 'staff', 'admin')
  @Delete(':id/avatar')
  @ApiOperation({ summary: 'Xóa avatar người dùng' })
  @ApiResponse({ status: 200, description: 'Avatar được xóa thành công' })
  @ResponseMessage('Xóa avatar thành công.')
  removeAvatar(@Param('id') id: string) {
    return this.usersService.removeAvatar(id);
  }

  @Roles('guest', 'staff', 'admin')
  @Patch('profile/avatar')
  @ApiOperation({ summary: 'Cập nhật avatar cá nhân' })
  @ApiResponse({ status: 200, description: 'Avatar cá nhân được cập nhật' })
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
  @ApiOperation({ summary: 'Lấy avatar cá nhân' })
  @ApiResponse({ status: 200, description: 'Avatar cá nhân' })
  @ResponseMessage('Lấy avatar cá nhân thành công.')
  getMyAvatar(@Request() req: RequestWithUser) {
    return this.usersService.getUserAvatar(req.user._id);
  }

  @Roles('guest', 'staff', 'admin')
  @Delete('profile/avatar')
  @ApiOperation({ summary: 'Xóa avatar cá nhân' })
  @ApiResponse({ status: 200, description: 'Avatar cá nhân được xóa' })
  @ResponseMessage('Xóa avatar cá nhân thành công.')
  removeMyAvatar(@Request() req: RequestWithUser) {
    return this.usersService.removeAvatar(req.user._id);
  }
}
