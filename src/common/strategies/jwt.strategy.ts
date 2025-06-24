import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import {
  RbacService,
  CustomRoleResponse,
} from '../../modules/auth/services/rbac.service';
import { UserWithPermissions } from '../../interfaces/user-with-permissions.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private rbacService: RbacService,
  ) {
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

  async validate(payload: JwtPayload): Promise<UserWithPermissions> {
    const { _id, email, name, role, iss } = payload;

    // Initialize with default arrays
    let permissions: string[] = [];
    let customRoles: string[] = [];

    // Load user permissions and roles if they are staff (admin bypasses anyway)
    if (role === 'staff') {
      try {
        // Load permissions and custom roles in parallel
        const [userPermissions, userCustomRoles]: [
          string[],
          CustomRoleResponse[],
        ] = await Promise.all([
          this.rbacService.getUserPermissions(_id),
          this.rbacService.getUserCustomRoles(_id),
        ]);

        permissions = userPermissions;
        customRoles = userCustomRoles.map((r) => r.key);
      } catch (error) {
        console.error(
          `Error loading permissions/roles for user ${_id}:`,
          error,
        );
        // Don't throw error, just log and continue with empty arrays
        permissions = [];
        customRoles = [];
      }
    }

    return {
      _id,
      email,
      name,
      role: role as 'guest' | 'staff' | 'admin',
      iss,
      permissions,
      customRoles,
    };
  }
}
