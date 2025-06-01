export interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  language: string;
  phone?: string;
  avatar_url: string;
  is_verified: boolean;
  isDeleted: boolean;
  deletedAt: Date;
}
