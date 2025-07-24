export interface JwtPayload {
  _id: string;
  email: string;
  name?: string;
  role: 'guest' | 'staff' | 'admin';
  customRoles: string[]; // Custom roles for display purposes
  // Note: Permissions are checked real-time via PermissionGuard, not stored in JWT
}
