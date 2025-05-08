import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { Public } from 'src/decorators/public.decorator';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Public()
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Public()
  @Post()
  createUser(@Body() createUserDto: CreateUserDto) {
    const user = this.usersService.createUser(createUserDto);
    return user;
  }

  @Public()
  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUserById(id);
  }
}
