import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/modules/users/users.service';
import { RegisterDto } from './dto/register.dto';
import * as bcryptjs from 'bcryptjs';
import { EmailQueueService } from '../mail/mail.queue';
import { UserDocument } from '../users/schemas/user.schema';
import { AuthRepo } from './auth.repo';
import { User } from '../users/users.interface';
import { RefreshTokenService } from './services/refresh-token.service';
import { Request, Response } from 'express';
import { toSafeString } from 'src/utils';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailQueueService: EmailQueueService,
    private readonly authRepo: AuthRepo,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  /**
   * Tìm người dùng theo ID
   */
  async findUserById(userId: string): Promise<UserDocument> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }
    return user;
  }

  /**
   * Xác thực người dùng
   */

  async validateUser(
    email: string,
    password: string,
  ): Promise<UserDocument | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    const isValid = await this.usersService.isValidPassword(
      password,
      user.password_hash,
    );
    return isValid ? user : null;
  }

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);

    // Tạo OTP và token
    const otp = this.authRepo.generateOtp();
    const token = this.authRepo.generateToken(dto.email);

    // Lưu OTP và token vào Redis
    await this.authRepo.storeOtpAndToken(dto.email, otp, token);

    if (existing) {
      // Nếu tài khoản bị vô hiệu hóa
      if (this.authRepo.isDeleted(existing)) {
        throw new ForbiddenException('Email này không thể sử dụng để đăng ký.');
      }

      // Nếu tài khoản đã xác minh
      if (this.authRepo.isVerified(existing)) {
        throw new ConflictException('Email đã tồn tại');
      }

      // Gửi lại email xác minh
      await this.emailQueueService.addVerificationEmail({
        email: existing.email,
        token,
        otp,
      });

      return {
        email: existing.email,
      };
    }

    // Nếu chưa tồn tại => tạo mới
    const hash = await bcryptjs.hash(dto.password, 10);
    const newUser = await this.usersService.create({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      password_hash: hash,
      is_verified: false,
    });

    // Gửi email xác minh mới
    await this.emailQueueService.addVerificationEmail({
      email: newUser.email,
      token,
      otp,
    });

    return {
      email: newUser.email,
    };
  }

  async resendVerificationEmail(email: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return {
        message: 'Nếu email tồn tại, hướng dẫn xác minh đã được gửi.',
      };
    }

    // Kiểm tra tài khoản bị vô hiệu hóa
    this.authRepo.throwIfDeleted(user);

    // Nếu đã xác minh rồi
    if (this.authRepo.isVerified(user)) {
      return {
        message: 'Tài khoản này đã được xác minh. Bạn có thể đăng nhập.',
      };
    }

    // Tạo OTP và token mới
    const otp = this.authRepo.generateOtp();
    const token = this.authRepo.generateToken(email);

    // Lưu OTP và token vào Redis
    await this.authRepo.storeOtpAndToken(email, otp, token);

    // Gửi email xác minh
    await this.emailQueueService.addVerificationEmail({
      email,
      token,
      otp,
    });

    return {
      email,
    };
  }

  async verifyEmailWithToken(token: string) {
    let decoded: { email: string };

    try {
      decoded = this.jwtService.verify<{ email: string }>(token);
    } catch {
      throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn');
    }

    const email = decoded.email;
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new NotFoundException('Email không tồn tại');
    }

    // Kiểm tra tài khoản bị vô hiệu hóa
    this.authRepo.throwIfDeleted(user);

    // Nếu đã xác minh rồi
    if (this.authRepo.isVerified(user)) {
      return { message: 'Tài khoản đã được xác minh trước đó.' };
    }

    const isValid = await this.authRepo.verifyToken(email, token);
    if (!isValid) {
      throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn');
    }

    await this.usersService.verifyUser(toSafeString(user._id));
    await this.authRepo.clearVerificationData(email); // xoá token + otp sau xác minh

    return {
      email,
      isVerified: true,
    };
  }

  async verifyEmailWithOtp(email: string, otp: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('Email không tồn tại');
    }

    // Kiểm tra tài khoản bị vô hiệu hóa
    this.authRepo.throwIfDeleted(user);

    // Nếu đã xác minh rồi
    if (this.authRepo.isVerified(user)) {
      return { message: 'Tài khoản này đã được xác minh trước đó' };
    }

    const isValid = await this.authRepo.verifyOtp(email, otp);
    if (!isValid) {
      throw new BadRequestException('Mã OTP không hợp lệ hoặc đã hết hạn');
    }

    await this.usersService.verifyUser(toSafeString(user._id));
    await this.authRepo.clearVerificationData(email);

    return {
      email,
      isVerified: true,
    };
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);

    // Nếu không tìm thấy tài khoản, trả về thông báo mặc định
    if (!user) {
      throw new NotFoundException('Email không tồn tại');
    }

    // Nếu tài khoản bị vô hiệu hóa, trả về thông báo lỗi
    if (this.authRepo.isDeleted(user)) {
      throw new ForbiddenException('Tài khoản đã bị vô hiệu hóa');
    }

    // Nếu tài khoản chưa xác minh, gợi ý xác minh trước
    if (!this.authRepo.isVerified(user)) {
      // Có thể thêm logic gửi lại email xác minh ở đây
      throw new UnauthorizedException(
        'Tài khoản chưa được xác minh. Vui lòng xác minh email trước.',
      );
    }

    // Tạo token reset password (1 giờ)
    const token = this.jwtService.sign(
      { email: user.email },
      { expiresIn: '1h' },
    );

    // Gửi email hướng dẫn reset password
    await this.emailQueueService.addResetPasswordEmail({
      email: user.email,
      token,
    });

    return {
      email: user.email,
      token,
    };
  }

  async resetPassword(token: string, newPassword: string) {
    let decoded: { email: string };

    try {
      decoded = this.jwtService.verify<{ email: string }>(token);
    } catch {
      throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn');
    }

    const email = decoded.email;
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new NotFoundException('Tài khoản không tồn tại');
    }

    // Kiểm tra tài khoản bị vô hiệu hóa
    this.authRepo.throwIfDeleted(user);

    // Kiểm tra tài khoản đã xác minh chưa
    this.authRepo.throwIfNotVerified(user);

    const hash = await bcryptjs.hash(newPassword, 10);
    await this.usersService.updatePassword(toSafeString(user._id), hash);

    return {
      email: user.email,
    };
  }

  /**
   * Xử lý đăng nhập
   */
  async handleLogin(
    user: UserDocument,
    req: Request,
    res: Response,
  ): Promise<{
    access_token: string;
    user: { _id: any; name: string; email: string; role: string };
  }> {
    // Tạo JWT access token
    const authResult = this.login(user as unknown as User);

    // Tạo refresh token và lưu vào DB
    const refreshTokenResult =
      await this.refreshTokenService.createRefreshToken(user, req);

    // Đặt refresh token vào HTTP only cookie
    this.refreshTokenService.setRefreshTokenCookie(
      res,
      refreshTokenResult.token,
      refreshTokenResult.expiresIn,
    );

    // Trả về access token và thông tin người dùng
    return authResult;
  }

  /**
   * Xử lý refresh token
   */
  async handleRefreshToken(
    refreshToken: string,
    req: Request,
    res: Response,
  ): Promise<{
    access_token: string;
    user: { _id: any; name: string; email: string; role: string };
  }> {
    if (!refreshToken) {
      this.refreshTokenService.clearRefreshTokenCookie(res);
      throw new UnauthorizedException('Không tìm thấy refresh token');
    }

    try {
      // Tìm và xác thực refresh token
      const tokenDoc =
        await this.refreshTokenService.findAndValidateRefreshToken(
          refreshToken,
        );

      // Lấy userId từ tokenDoc và chuyển thành string an toàn
      const userId = toSafeString(tokenDoc.userId);
      if (!userId) {
        throw new UnauthorizedException('Token không hợp lệ: thiếu userId');
      }

      // Tìm user tương ứng
      const user = await this.findUserById(userId);

      // Tạo refresh token mới (rotation) và lưu vào DB
      const refreshTokenResult =
        await this.refreshTokenService.createRefreshToken(user, req);

      // Đặt refresh token mới vào cookie
      this.refreshTokenService.setRefreshTokenCookie(
        res,
        refreshTokenResult.token,
        refreshTokenResult.expiresIn,
      );

      // Thu hồi refresh token cũ
      const tokenId = toSafeString(tokenDoc._id);
      const userIdStr = toSafeString(user._id);

      await this.refreshTokenService.revokeRefreshToken(tokenId, userIdStr);

      // Trả về access token mới
      return this.login(user as unknown as User);
    } catch (error) {
      // Xóa cookie nếu có lỗi
      this.refreshTokenService.clearRefreshTokenCookie(res);
      console.log(
        'Lỗi khi refresh token:',
        error instanceof Error ? error.message : 'Lỗi không xác định',
      );
      throw new UnauthorizedException(
        'Phiên đăng nhập hết hạn hoặc không hợp lệ, vui lòng đăng nhập lại',
      );
    }
  }

  /**
   * Xử lý đăng xuất
   */
  async handleLogout(
    user: UserDocument,
    refreshToken: string | undefined,
    res: Response,
  ): Promise<void> {
    // Xóa refresh token cookie
    this.refreshTokenService.clearRefreshTokenCookie(res);
    console.log('người dùng', user);

    // Thu hồi refresh token hiện tại (nếu có)
    if (refreshToken) {
      try {
        const tokenDoc =
          await this.refreshTokenService.findAndValidateRefreshToken(
            refreshToken,
          );

        const tokenId = toSafeString(tokenDoc._id);
        const userId = toSafeString(user._id);
        console.log('xử lý đăng xuất', tokenId, userId);

        await this.refreshTokenService.revokeRefreshToken(tokenId, userId);
      } catch (error) {
        // Thử thu hồi theo cách khác nếu không tìm thấy token chính xác
        const userId = toSafeString(user._id);

        // Thu hồi tất cả token của user để đảm bảo an toàn
        await this.refreshTokenService.revokeAllRefreshTokens(userId);
        console.log(
          'Đã thu hồi tất cả token sau khi không thể xác định token cụ thể:',
          error instanceof Error ? error.message : 'Lỗi không xác định',
        );
      }
    }
  }

  /**
   * Xử lý đăng xuất khỏi các thiết bị khác
   */
  async handleLogoutOtherDevices(
    user: UserDocument,
    refreshToken: string | undefined,
  ): Promise<void> {
    if (!refreshToken) {
      throw new UnauthorizedException(
        'Không tìm thấy phiên đăng nhập hiện tại',
      );
    }

    try {
      const tokenDoc =
        await this.refreshTokenService.findAndValidateRefreshToken(
          refreshToken,
        );

      const tokenId = toSafeString(tokenDoc._id);
      const userId = toSafeString(user._id);

      await this.refreshTokenService.revokeOtherRefreshTokens(userId, tokenId);
    } catch {
      // Nếu không tìm được token hiện tại, vẫn có thể thu hồi tất cả
      const userId = toSafeString(user._id);
      await this.refreshTokenService.revokeAllRefreshTokens(userId);
      throw new UnauthorizedException(
        'Phiên đăng nhập không hợp lệ, đã thu hồi tất cả phiên để đảm bảo an toàn',
      );
    }
  }

  /**
   * Lấy danh sách các phiên đăng nhập
   */
  async getSessions(user: UserDocument): Promise<any[]> {
    const userId = toSafeString(user._id);
    return this.refreshTokenService.getRefreshTokens(userId);
  }

  /**
   * Thu hồi một phiên đăng nhập cụ thể
   */
  async revokeSession(sessionId: string, user: UserDocument): Promise<void> {
    const userId = toSafeString(user._id);
    return this.refreshTokenService.revokeRefreshToken(sessionId, userId);
  }

  /**
   * Thu hồi tất cả phiên đăng nhập
   */
  async revokeAllSessions(user: UserDocument): Promise<void> {
    const userId = toSafeString(user._id);
    return this.refreshTokenService.revokeAllRefreshTokens(userId);
  }

  login(user: User) {
    const payload = {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      iss: 'api',
    };
    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async deleteAccount(user: UserDocument) {
    this.authRepo.throwIfDeleted(user);

    await this.usersService.deleteUserById(toSafeString(user._id));
    await this.authRepo.clearVerificationData(user.email);

    return {
      email: user.email,
      name: user.name,
      deleted: user.isDeleted,
    };
  }

  async getMe(user: UserDocument) {
    const userInfo = await this.usersService.findById(toSafeString(user._id));
    if (!userInfo) {
      throw new NotFoundException('Không tìm thấy thông tin người dùng');
    }

    this.authRepo.throwIfNotVerified(userInfo);
    this.authRepo.throwIfDeleted(userInfo);

    return {
      user: userInfo,
    };
  }
}
