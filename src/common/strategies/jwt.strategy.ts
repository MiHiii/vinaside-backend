import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    const jwtSecret = configService.get<string>('JWT_ACCESS_SECRET');
    if (!jwtSecret) {
      throw new Error(
        'JWT_ACCESS_SECRET không được định nghĩa trong biến môi trường',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    const { _id, email, name, role, customRoles } = payload;

    // Return user info from JWT payload
    // Note: Permissions are checked real-time, not from JWT
    return {
      _id,
      email,
      name,
      role,
      customRoles: customRoles || [],
    };
  }
}
