export interface JwtPayload {
  _id: string;
  email: string;
  name?: string;
  role: 'guest' | 'staff' | 'admin';
  permissions: string[];
  customRoles: string[];
}
