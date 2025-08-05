export class ListingResponseDto {
  _id: string;
  propertyId: string;
  title: string;
  description?: string;
  images: string[];
  price_per_night: number;
  guests: number;
  max_guests: number;
  allow_infants: boolean;
  max_infants: number;
  beds: number;
  bathrooms: number;
  amenities?: string[];
  house_rules_selected?: string[];
  safety_features?: string[];
  service_ids?: string[];
  voucher_ids?: string[];
  other_rules?: string[];
  cancel_policy?: string;
  allow_pets: boolean;
  is_verified: boolean;
  status?: string;
  average_rating?: number;
  reviews_count?: number;
  viewCount?: number;
  created_at?: Date;
  updated_at?: Date;

  // Weekend surcharge fields
  has_weekend_surcharge?: boolean;
  weekend_surcharge_percent?: number;
}
