import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  RefreshToken,
  RefreshTokenDocument,
} from '../schemas/refresh-token.schema';
import * as crypto from 'crypto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { UserDocument } from 'src/modules/users/schemas/user.schema';
import { toSafeString } from 'src/utils';

@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectModel(RefreshToken.name)
    private refreshTokenModel: Model<RefreshTokenDocument>,
    private configService: ConfigService,
  ) {}

  /**
   * Hash token để lưu vào DB
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Tạo refresh token mới và lưu vào DB
   */
  async createRefreshToken(
    user: UserDocument,
    req: Request,
  ): Promise<{ token: string; expiresIn: number }> {
    // Tạo refresh token ngẫu nhiên
    const refreshToken = crypto.randomBytes(40).toString('hex');
    // Hash token trước khi lưu vào DB
    const refreshTokenHash = this.hashToken(refreshToken);

    const expiresInDays = parseInt(
      this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN') || '30',
      10,
    );
    // Chuyển đổi thành milliseconds
    const expiresIn = expiresInDays * 24 * 60 * 60 * 1000;

    // Tính toán thời gian hết hạn
    const expiresAt = new Date();
    expiresAt.setTime(expiresAt.getTime() + expiresIn);

    // Lưu thông tin thiết bị
    const deviceInfo = {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };

    // Lưu token vào DB
    await this.refreshTokenModel.create({
      userId: user._id,
      tokenHash: refreshTokenHash,
      expiresAt,
      deviceInfo,
    });

    return {
      token: refreshToken,
      expiresIn,
    };
  }

  /**
   * Thiết lập HTTP-only cookie chứa refresh token
   */
  setRefreshTokenCookie(res: Response, token: string, expiresIn: number): void {
    // Thiết lập HTTP-only cookie
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'strict',
      maxAge: expiresIn, // milliseconds
      path: '/', // Chỉ gửi cookie khi gọi API refresh
    });
  }

  /**
   * Xóa refresh token cookie
   */
  clearRefreshTokenCookie(res: Response): void {
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }

  /**
   * Tìm refresh token và kiểm tra tính hợp lệ
   */
  async findAndValidateRefreshToken(
    refreshToken: string,
  ): Promise<RefreshTokenDocument> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token không được cung cấp');
    }

    // Hash token để tìm trong DB
    const refreshTokenHash = this.hashToken(refreshToken);

    // Tìm token trong DB
    const token = await this.refreshTokenModel.findOne({
      tokenHash: refreshTokenHash,
      revoked: false,
      expiresAt: { $gt: new Date() },
    });

    if (!token) {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }

    return token;
  }

  /**
   * Đăng xuất khỏi một thiết bị cụ thể (thu hồi refresh token)
   */
  async revokeRefreshToken(tokenId: string, userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(tokenId)) {
      throw new BadRequestException('ID token không hợp lệ');
    }

    const token = await this.refreshTokenModel.findById(tokenId);
    if (!token) {
      throw new NotFoundException('Không tìm thấy phiên đăng nhập');
    }

    // Kiểm tra token thuộc về user
    const tokenUserId = toSafeString(token.userId);
    console.log(tokenUserId, userId);

    if (tokenUserId !== userId) {
      throw new UnauthorizedException('Không có quyền thu hồi phiên này');
    }

    // Thu hồi token
    token.revoked = true;
    await token.save();
  }

  /**
   * Đăng xuất khỏi tất cả thiết bị (thu hồi tất cả refresh token)
   */
  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.refreshTokenModel.updateMany(
      { userId: new Types.ObjectId(userId), revoked: false },
      { revoked: true },
    );
  }

  /**
   * Đăng xuất khỏi tất cả thiết bị khác (giữ lại token hiện tại)
   */
  async revokeOtherRefreshTokens(
    userId: string,
    currentTokenId: string,
  ): Promise<void> {
    await this.refreshTokenModel.updateMany(
      {
        userId: new Types.ObjectId(userId),
        _id: { $ne: new Types.ObjectId(currentTokenId) },
        revoked: false,
      },
      { revoked: true },
    );
  }

  /**
   * Lấy danh sách các phiên đăng nhập (thiết bị) của user
   */
  async getRefreshTokens(userId: string): Promise<RefreshTokenDocument[]> {
    return this.refreshTokenModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Cronjob chạy mỗi ngày để xóa các token đã thu hồi và hết hạn
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) // Chạy vào 00:00 mỗi ngày
  async cleanupExpiredTokens(): Promise<void> {
    try {
      const result = await this.refreshTokenModel.deleteMany({
        $or: [{ revoked: true }, { expiresAt: { $lt: new Date() } }],
      });

      console.log(
        `Đã xóa ${result.deletedCount} refresh token hết hạn hoặc đã thu hồi`,
      );
    } catch (error) {
      console.error('Lỗi khi xóa token hết hạn:', error);
    }
  }
}
