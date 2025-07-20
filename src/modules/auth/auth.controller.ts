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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { LocalAuthGuard } from '../../common/guards/local-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { UserDocument } from '../users/schemas/user.schema';
import { AuthService } from './auth.service';
import { Public } from '../../decorators/public.decorator';
import { Roles } from '../../decorators/roles.decorator';
import { RegisterDto } from './dto/register.dto';
import { ResponseMessage } from '../../decorators/response-message.decorator';

import {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';

// Interface for authenticated requests
interface AuthenticatedRequest extends ExpressRequest {
  user: UserDocument & { _id: { toString(): string } };
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ========== PUBLIC ENDPOINTS ==========

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'User login',
    description: 'Authenticate user with email and password',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@example.com' },
        password: { type: 'string', example: 'password123' },
      },
      required: ['email', 'password'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ResponseMessage('Đăng nhập thành công.')
  async login(
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
  @HttpCode(201)
  @ApiOperation({
    summary: 'User registration',
    description: 'Register new user account',
  })
  @ApiResponse({
    status: 201,
    description: 'Registration successful. Verification email sent.',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @ResponseMessage(
    'Đăng ký thành công. Vui lòng kiểm tra email để xác minh tài khoản.',
  )
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('refresh-token')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Get new access token using refresh token from cookie',
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  @ResponseMessage('Token làm mới thành công.')
  async refreshToken(
    @Request() req: ExpressRequest,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    const refreshToken = req.cookies?.['refresh_token'] as string;
    return this.authService.handleRefreshToken(refreshToken, req, res);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Resend verification email',
    description: 'Resend email verification instructions',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@example.com' },
      },
      required: ['email'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Verification email sent if account exists',
  })
  @ResponseMessage('Hướng dẫn xác minh đã được gửi lại đến email của bạn.')
  async resendVerification(@Body('email') email: string) {
    return this.authService.resendVerificationEmail(email);
  }

  @Public()
  @Post('verify-email-otp')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify email with OTP',
    description: 'Verify user email using OTP code',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@example.com' },
        otp: { type: 'string', example: '123456' },
      },
      required: ['email', 'otp'],
    },
  })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  @ResponseMessage('Xác minh email thành công. Bạn có thể đăng nhập.')
  async verifyEmailWithOtp(
    @Body('email') email: string,
    @Body('otp') otp: string,
  ) {
    return this.authService.verifyEmailWithOtp(email, otp);
  }

  @Public()
  @Get('verify-email/:token')
  @ApiOperation({
    summary: 'Verify email with token',
    description: 'Verify user email using verification token',
  })
  @ApiParam({
    name: 'token',
    description: 'Email verification token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  @ResponseMessage('Xác minh email thành công. Bạn có thể đăng nhập.')
  async verifyEmailWithToken(@Param('token') token: string) {
    return this.authService.verifyEmailWithToken(token);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Request password reset',
    description: 'Send password reset instructions to email',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@example.com' },
      },
      required: ['email'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset instructions sent if account exists',
  })
  @ResponseMessage('Hướng dẫn đặt lại mật khẩu đã được gửi đến email của bạn.')
  async forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reset password',
    description: 'Reset user password using reset token',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string', example: 'reset-token-here' },
        newPassword: { type: 'string', example: 'newPassword123' },
      },
      required: ['token', 'newPassword'],
    },
  })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  @ResponseMessage('Mật khẩu đã được đặt lại thành công.')
  async resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.authService.resetPassword(token, newPassword);
  }

  // ========== AUTHENTICATED ENDPOINTS ==========

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Get authenticated user information',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  @ResponseMessage('Lấy thông tin người dùng thành công.')
  getMe(@Request() req: AuthenticatedRequest) {
    return this.authService.getMe(req.user);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({
    summary: 'User logout',
    description: 'Logout user and invalidate refresh token',
  })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  @ResponseMessage('Đăng xuất thành công.')
  async logout(
    @Request() req: AuthenticatedRequest,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    const refreshToken = req.cookies?.['refresh_token'] as string | undefined;
    return this.authService.handleLogout(req.user, refreshToken, res);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @ApiBearerAuth()
  @Get('sessions')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({
    summary: 'Get user sessions',
    description: 'Get list of active sessions for current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Sessions retrieved successfully',
  })
  @ResponseMessage('Lấy danh sách phiên đăng nhập thành công.')
  async getSessions(@Request() req: AuthenticatedRequest) {
    return this.authService.getSessions(req.user);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @ApiBearerAuth()
  @Delete('sessions/:sessionId')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({
    summary: 'Revoke specific session',
    description: 'Revoke a specific user session',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session ID to revoke',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({ status: 200, description: 'Session revoked successfully' })
  @ResponseMessage('Thu hồi phiên đăng nhập thành công.')
  async revokeSession(
    @Param('sessionId') sessionId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.authService.revokeSession(sessionId, req.user);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @ApiBearerAuth()
  @Delete('sessions')
  @HttpCode(204)
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({
    summary: 'Revoke all sessions',
    description: 'Revoke all sessions for current user',
  })
  @ApiResponse({
    status: 204,
    description: 'All sessions revoked successfully',
  })
  @ResponseMessage('Thu hồi tất cả phiên đăng nhập thành công.')
  async revokeAllSessions(@Request() req: AuthenticatedRequest) {
    await this.authService.revokeAllSessions(req.user);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @ApiBearerAuth()
  @Delete('sessions/other')
  @HttpCode(204)
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({
    summary: 'Revoke other sessions',
    description: 'Revoke all sessions except current one',
  })
  @ApiResponse({
    status: 204,
    description: 'Other sessions revoked successfully',
  })
  @ResponseMessage('Thu hồi các phiên đăng nhập khác thành công.')
  async revokeOtherSessions(@Request() req: AuthenticatedRequest) {
    const refreshToken = req.cookies?.['refresh_token'] as string | undefined;
    await this.authService.handleLogoutOtherDevices(req.user, refreshToken);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @ApiBearerAuth()
  @Delete('delete-account')
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({
    summary: 'Delete user account',
    description: 'Permanently delete current user account',
  })
  @ApiResponse({ status: 200, description: 'Account deleted successfully' })
  @ResponseMessage('Xóa tài khoản thành công.')
  async deleteAccount(@Request() req: AuthenticatedRequest) {
    return this.authService.deleteAccount(req.user);
  }
}
