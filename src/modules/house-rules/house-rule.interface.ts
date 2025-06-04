export interface IHouseRule {
  name: string;
  description?: string;
  icon_url?: string;
  default_checked: boolean;
  is_active: boolean;
  isDeleted?: boolean;
}
