import { Controller, Get, Post, Request, UseGuards } from '@nestjs/common';

import { LocalAuthGuard } from '../../common/guards/local-auth.guard';
import { User } from '../users/users.interface';
import { AuthService } from './auth.service';
import { Public } from '../../decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  handleLogin(@Request() req: { user: User }) {
    console.log('req.user', req.user);
    return this.authService.login(req.user);
  }

  @Get('profile')
  getProfile(@Request() req: { user: User }) {
    return req.user;
  }
}
