import { Module, Global } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { LocalStrategy } from './strategies/local.strategy';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from '../../common/strategies/jwt.strategy';
import { MailModule } from '../mail/mail.module';
import { AuthRepo } from './auth.repo';
import { MongooseModule } from '@nestjs/mongoose';
import {
  RefreshToken,
  RefreshTokenSchema,
} from './schemas/refresh-token.schema';
import { RefreshTokenService } from './services/refresh-token.service';
import { ScheduleModule } from '@nestjs/schedule';
import { RbacService } from './services/rbac.service';
import { RbacManagementService } from './services/rbac-management.service';
import { CustomRole, CustomRoleSchema } from './schemas/custom-role.schema';
import { Permission, PermissionSchema } from './schemas/permission.schema';
import {
  CustomRolePermission,
  CustomRolePermissionSchema,
} from './schemas/custom-role-permission.schema';
import {
  UserCustomRole,
  UserCustomRoleSchema,
} from './schemas/user-custom-role.schema';
import { RbacController } from './controllers/rbac.controller';

@Global()
@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '7d') },
      }),
    }),
    MongooseModule.forFeature([
      { name: RefreshToken.name, schema: RefreshTokenSchema },
      { name: CustomRole.name, schema: CustomRoleSchema },
      { name: Permission.name, schema: PermissionSchema },
      { name: CustomRolePermission.name, schema: CustomRolePermissionSchema },
      { name: UserCustomRole.name, schema: UserCustomRoleSchema },
    ]),
    ScheduleModule.forRoot(),
    MailModule,
  ],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    AuthRepo,
    RefreshTokenService,
    RbacService,
    RbacManagementService,
  ],
  controllers: [AuthController, RbacController],
  exports: [
    AuthService,
    AuthRepo,
    RefreshTokenService,
    RbacService,
    RbacManagementService,
  ],
})
export class AuthModule {}
