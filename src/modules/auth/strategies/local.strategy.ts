import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';
import { UserDocument } from '../../users/schemas/user.schema';
import { AuthRepo } from '../auth.repo';

/**
 * Local authentication strategy
 * Note: This strategy is kept in the auth module because it depends on AuthService.
 * Unlike JWT strategy which is stateless, local strategy requires direct service dependency.
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    private authRepo: AuthRepo,
  ) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<UserDocument> {
    const user = await this.authService.validateUser(email, password);

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    // Kiểm tra tài khoản đã bị vô hiệu hóa
    if (this.authRepo.isDeleted(user)) {
      throw new ForbiddenException('Tài khoản không tồn tại');
    }

    // Kiểm tra tài khoản đã xác minh hay chưa
    if (!this.authRepo.isVerified(user)) {
      await this.authService.resendVerificationEmail(user.email);
      throw new UnauthorizedException(
        'Tài khoản chưa được xác minh. Vui lòng kiểm tra email của bạn',
      );
    }

    return user;
  }
}
