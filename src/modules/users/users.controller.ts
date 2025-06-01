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
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles } from 'src/decorators/roles.decorator';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { QueryUserDto } from './dto/query-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

interface ApiResponse<T> {
  data?: T;
  success?: boolean;
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
}
