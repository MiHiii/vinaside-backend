export class PropertyStaffResponseDto {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  role: string;
  is_online?: boolean;
  last_seen?: Date;
}
