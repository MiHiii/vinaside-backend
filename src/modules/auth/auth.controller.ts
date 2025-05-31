import {
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
  Body,
  Param,
} from '@nestjs/common';

import { LocalAuthGuard } from '../../common/guards/local-auth.guard';
import { UserDocument } from '../users/schemas/user.schema';
import { AuthService } from './auth.service';
import { Public } from '../../decorators/public.decorator';
import { RegisterDto } from './dto/register.dto';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { User } from '../users/users.interface';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ResponseMessage('Đăng nhập thành công.')
  handleLogin(@Request() req: { user: User }) {
    return this.authService.login(req.user);
  }

  @Public()
  @Post('register')
  @ResponseMessage(
    'Đăng ký thành công. Vui lòng kiểm tra email để xác minh tài khoản.',
  )
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('resend-verification')
  @ResponseMessage('Hướng dẫn xác minh đã được gửi lại đến email của bạn.')
  async resendVerification(@Body('email') email: string) {
    return this.authService.resendVerificationEmail(email);
  }

  @Public()
  @Post('verify-email-otp')
  @ResponseMessage('Xác minh email thành công. Bạn có thể đăng nhập.')
  async verifyEmailWithOtp(
    @Body('email') email: string,
    @Body('otp') otp: string,
  ) {
    return this.authService.verifyEmailWithOtp(email, otp);
  }

  @Public()
  @Get('verify-email/:token')
  @ResponseMessage('Xác minh email thành công. Bạn có thể đăng nhập.')
  async verifyEmailWithToken(@Param('token') token: string) {
    return this.authService.verifyEmailWithToken(token);
  }

  @Get('profile')
  getProfile(@Request() req: { user: UserDocument }) {
    return req.user;
  }
}
