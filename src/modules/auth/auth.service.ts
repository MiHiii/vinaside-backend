import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from 'src/modules/users/users.interface';
import { UsersService } from 'src/modules/users/users.service';
import { UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private userService: UsersService,
    private jwtService: JwtService,
  ) {}
  async validateUser(
    username: string,
    password: string,
  ): Promise<UserDocument | null> {
    const user = await this.userService.findOneByUsername(username);
    if (!user) return null;

    const isValid = await this.userService.isValidPassword(
      password,
      user.password,
    );
    return isValid ? user : null;
  }

  login(user: User) {
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
        permissions: user.permissions,
      },
    };
  }
}
