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
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { QueryUserDto } from './dto/query-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
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
  findAll(
    @Query() query: QueryUserDto,
    @Request() req: RequestWithUser,
  ): Promise<any> {
    return this.usersService.findAllWithFilters(query, req.user);
  }

  @RequirePermission('user.view')
  @Get('staff')
  @ApiOperation({ summary: 'Lấy danh sách tất cả nhân viên (staff)' })
  @ApiResponse({ status: 200, description: 'Danh sách nhân viên' })
  @ResponseMessage('Lấy danh sách nhân viên thành công.')
  findAllStaff(
    @Query() query: Omit<QueryUserDto, 'role'>,
    @Request() req: RequestWithUser,
  ): Promise<any> {
    // Force role to be 'staff' and include common fields
    const staffQuery: QueryUserDto = {
      ...query,
      role: 'staff',
      isDeleted: false, // Only active staff
      select: 'name email phone avatar_url createdAt is_verified role',
    };

    return this.usersService.findAllWithFilters(staffQuery, req.user);
  }

  @RequirePermission('user.view')
  @Get('count/total')
  @ApiOperation({ summary: 'Đếm tổng số người dùng' })
  @ApiResponse({ status: 200, description: 'Số lượng người dùng' })
  @ResponseMessage('Đếm số lượng người dùng thành công.')
  count(
    @Request() req: RequestWithUser,
  ): Promise<ApiResponse<{ count: number }>> {
    return this.usersService.count(req.user);
  }

  @RequirePermission('user.view')
  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin người dùng theo ID' })
  @ApiResponse({ status: 200, description: 'Thông tin người dùng' })
  @ResponseMessage('Lấy thông tin người dùng thành công.')
  findOne(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ): Promise<ApiResponse<any>> {
    return this.usersService.findOne(id, req.user);
  }

  @RequirePermission('user.edit')
  @Post()
  @ApiOperation({ summary: 'Tạo người dùng mới' })
  @ApiResponse({ status: 201, description: 'Người dùng được tạo thành công' })
  @ResponseMessage('Tạo người dùng thành công.')
  create(
    @Body() createUserDto: CreateUserDto,
    @Request() req: RequestWithUser,
  ): Promise<ApiResponse<any>> {
    return this.usersService.createUser(createUserDto, req.user);
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
    @Request() req: RequestWithUser,
  ): Promise<ApiResponse<any>> {
    return this.usersService.updateFull(id, updateUserDto, req.user);
  }

  @RequirePermission('user.edit')
  @Patch('me')
  @ApiOperation({ summary: 'Cập nhật thông tin cá nhân (user tự cập nhật)' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin cá nhân được cập nhật',
  })
  @ResponseMessage('Cập nhật thông tin cá nhân thành công.')
  updateMe(
    @Body() updateUserDto: UpdateUserDto,
    @Request() req: RequestWithUser,
  ): Promise<ApiResponse<any>> {
    const userId = req.user._id;
    console.log('PATCH /users/me', { userId, updateUserDto });
    return this.usersService.updatePartial(userId, updateUserDto, req.user);
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
    @Request() req: RequestWithUser,
  ): Promise<ApiResponse<any>> {
    return this.usersService.updatePartial(id, updateUserDto, req.user);
  }

  @RequirePermission('user.edit')
  @Patch(':id/toggle-status')
  @ApiOperation({ summary: 'Thay đổi trạng thái người dùng (active/inactive)' })
  @ApiResponse({
    status: 200,
    description: 'Trạng thái người dùng được thay đổi',
  })
  @ResponseMessage('Thay đổi trạng thái người dùng thành công.')
  toggleStatus(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ): Promise<ApiResponse<any>> {
    return this.usersService.toggleStatus(id, req.user);
  }

  @RequirePermission('user.delete')
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Xóa người dùng' })
  @ApiResponse({ status: 204, description: 'Người dùng được xóa thành công' })
  @ResponseMessage('Xóa người dùng thành công.')
  delete(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ): Promise<ApiResponse<any>> {
    return this.usersService.delete(id, req.user);
  }
}
