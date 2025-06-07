export interface IAmenity {
  name: string;
  description?: string;
  icon_url: string;
  room_id: string; // Liên kết tới phòng cụ thể
  isDeleted: boolean;
  is_active?: boolean;
  created_at: Date;
  updated_at: Date;
}
