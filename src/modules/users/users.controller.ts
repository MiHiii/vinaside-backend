import { Body, Controller, Delete, Get, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { Public } from 'src/decorators/public.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Public()
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Public()
  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUserById(id);
  }
}
