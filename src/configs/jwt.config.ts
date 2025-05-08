import { JwtModuleOptions } from '@nestjs/jwt';

export const getJwtConfig = (): JwtModuleOptions => {
  return {
    secret: process.env.JWT_SECRET || 'default_secret_key',
    signOptions: {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    },
  };
};
