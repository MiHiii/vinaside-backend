export interface JwtPayload {
  _id: string;
  email: string;
  name?: string;
  role?: string;
  iss?: string;
}
