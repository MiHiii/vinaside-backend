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

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailQueueService: EmailQueueService,
    private readonly authRepo: AuthRepo,
  ) {}

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
      ...dto,
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

    await this.usersService.verifyUser(user._id.toString());
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

    await this.usersService.verifyUser(user._id.toString());
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
    await this.usersService.updatePassword(user._id.toString(), hash);

    return {
      email: user.email,
    };
  }

  login(user: UserDocument | User) {
    const payload = {
      sub: user._id,
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
}
