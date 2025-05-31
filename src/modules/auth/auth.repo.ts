import { Injectable, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { randomInt } from 'crypto';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { UserDocument } from 'src/modules/users/schemas/user.schema';

@Injectable()
export class AuthRepo {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // 👉 Sinh OTP 8 số
  generateOtp(): string {
    return randomInt(10000000, 99999999).toString();
  }

  // 👉 Sinh JWT token để xác minh
  generateToken(email: string): string {
    return this.jwtService.sign({ email }, { expiresIn: '1d' });
  }

  // 👉 Băm SHA256 (cho OTP & token)
  hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  // 👉 Lưu OTP & token đã hash vào Redis
  async storeOtpAndToken(email: string, otp: string, token: string, ttl = 900) {
    const otpHash = this.hash(otp);
    const tokenHash = this.hash(token);

    await this.redis.set(`verify:otp:${email}`, otpHash, 'EX', ttl);
    await this.redis.set(`verify:token:${email}`, tokenHash, 'EX', ttl);
  }

  // 👉 Xác minh OTP
  async verifyOtp(email: string, inputOtp: string): Promise<boolean> {
    const storedHash = await this.redis.get(`verify:otp:${email}`);
    if (!storedHash) return false;
    return storedHash === this.hash(inputOtp);
  }

  // 👉 Xác minh token
  async verifyToken(email: string, inputToken: string): Promise<boolean> {
    const storedHash = await this.redis.get(`verify:token:${email}`);
    if (!storedHash) return false;
    return storedHash === this.hash(inputToken);
  }

  // ✅ Sau khi xác minh xong → xoá khỏi Redis
  async clearVerificationData(email: string) {
    await this.redis.del(`verify:otp:${email}`);
    await this.redis.del(`verify:token:${email}`);
  }

  // 🔍 Kiểm tra user đã xác minh chưa
  isVerified(user: UserDocument): boolean {
    return user.is_verified;
  }

  // 🔍 Kiểm tra user đã bị xóa mềm chưa
  isDeleted(user: UserDocument): boolean {
    return !!user.isDeleted;
  }

  // ❌ Nếu chưa xác minh → ném lỗi
  throwIfNotVerified(user: UserDocument) {
    if (!this.isVerified(user)) {
      throw new ForbiddenException('Tài khoản chưa được xác minh');
    }
  }

  // ❌ Nếu đã bị xóa → ném lỗi
  throwIfDeleted(user: UserDocument) {
    if (this.isDeleted(user)) {
      throw new ForbiddenException('Tài khoản đã bị vô hiệu hóa');
    }
  }
}
