import {
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
  Body,
  Param,
  Response,
  HttpCode,
  Delete,
} from '@nestjs/common';

import { LocalAuthGuard } from '../../common/guards/local-auth.guard';
import { UserDocument } from '../users/schemas/user.schema';
import { AuthService } from './auth.service';
import { Public } from '../../decorators/public.decorator';
import { RegisterDto } from './dto/register.dto';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';

// Định nghĩa interface cho request với user
interface RequestWithUser extends Omit<ExpressRequest, 'cookies'> {
  user: UserDocument & { _id: { toString(): string } };
  cookies?: { [key: string]: string };
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ResponseMessage('Đăng nhập thành công.')
  async handleLogin(
    @Request() req: { user: UserDocument },
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    return this.authService.handleLogin(
      req.user,
      req as unknown as ExpressRequest,
      res,
    );
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

  @Public()
  @Post('refresh-token')
  @ResponseMessage('Đăng nhập thành công.')
  @HttpCode(200)
  async refreshToken(
    @Request() req: ExpressRequest,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<{
    access_token: string;
    user: { _id: any; name: string; email: string; role: string };
  }> {
    // Lấy refresh token từ cookie
    const refreshToken = req.cookies?.['refresh_token'] as string;

    // Sử dụng service để xử lý refresh token
    return this.authService.handleRefreshToken(refreshToken, req, res);
  }

  @Post('logout')
  @ResponseMessage('Đăng xuất thành công.')
  async logout(
    @Request() req: RequestWithUser,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    console.log('logout', req.cookies);
    // Xử lý đăng xuất qua service
    return await this.authService.handleLogout(
      req.user,
      req.cookies?.['refresh_token'],
      res,
    );
  }

  @Get('sessions')
  @ResponseMessage('Lấy danh sách phiên đăng nhập thành công.')
  async getSessions(@Request() req: RequestWithUser) {
    return this.authService.getSessions(req.user);
  }

  @Delete('sessions/:id')
  @ResponseMessage('Thu hồi phiên đăng nhập thành công.')
  async revokeSession(
    @Param('id') sessionId: string,
    @Request() req: RequestWithUser,
  ) {
    return await this.authService.revokeSession(sessionId, req.user);
  }

  @Delete('sessions')
  @ResponseMessage('Thu hồi tất cả phiên đăng nhập thành công.')
  @HttpCode(204)
  async revokeAllSessions(@Request() req: RequestWithUser) {
    await this.authService.revokeAllSessions(req.user);
    return;
  }

  @Delete('sessions/other')
  @ResponseMessage('Thu hồi các phiên đăng nhập khác thành công.')
  @HttpCode(204)
  async revokeOtherSessions(@Request() req: RequestWithUser) {
    // Sử dụng service để xử lý logout các thiết bị khác
    await this.authService.handleLogoutOtherDevices(
      req.user,
      req.cookies?.['refresh_token'],
    );
    return;
  }

  @Public()
  @Post('forgot-password')
  @ResponseMessage('Hướng dẫn đặt lại mật khẩu đã được gửi đến email của bạn.')
  async forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Public()
  @Post('reset-password')
  @ResponseMessage('Mật khẩu đã được đặt lại thành công.')
  async resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.authService.resetPassword(token, newPassword);
  }

  @Delete('delete-account')
  @ResponseMessage('Xóa tài khoản thành công.')
  async deleteAccount(@Request() req: RequestWithUser) {
    return this.authService.deleteAccount(req.user);
  }

  @Get('me')
  @ResponseMessage('Lấy thông tin người dùng thành công.')
  getMe(@Request() req: RequestWithUser) {
    return this.authService.getMe(req.user);
  }
}
