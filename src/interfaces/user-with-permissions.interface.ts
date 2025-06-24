import { JwtPayload } from './jwt-payload.interface';

export interface UserWithPermissions extends JwtPayload {
  _id: string;
  email: string;
  name?: string;
  role: 'guest' | 'staff' | 'admin';
  iss?: string;
  permissions: string[];
  customRoles: string[];
  phone?: string;
}

export interface JwtPayloadWithPermissions extends UserWithPermissions {
  iat?: number;
  exp?: number;
}
