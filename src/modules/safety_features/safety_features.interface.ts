export interface ISafetyFeature {
  name: string;
  description?: string;
  icon_url: string;
  room_id: string; // Liên kết tới phòng cụ thể
  isDeleted: boolean;
  created_at: Date;
  updated_at: Date;
}