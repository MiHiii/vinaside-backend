import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { UserDocument } from '../../users/schemas/user.schema';

/**
 * Local authentication strategy
 * Note: This strategy is kept in the auth module because it depends on AuthService.
 * Unlike JWT strategy which is stateless, local strategy requires direct service dependency.
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super();
  }

  async validate(username: string, password: string): Promise<UserDocument> {
    const user = await this.authService.validateUser(username, password);
    if (!user) {
      throw new UnauthorizedException('Username or password is incorrect');
    }
    return user;
  }
}
