export class BookingServiceResponseDto {
  service_id: string;
  service_name: string;
  service_price: number;
  quantity: number;
  total_price: number;
}

export class BookingResponseDto {
  _id: string;
  propertyId:
    | string
    | {
        _id: string;
        name: string;
        location?: {
          address?: string;
          ward?: string;
          district?: string;
          city?: string;
        };
      };
  listingId: string;
  guestId: string;
  checkInDate: Date;
  check_out_date: Date;
  guests: number;
  infants: number;
  nights: number;
  price_per_night: number;
  total_price: number; // Giá phòng cơ bản
  selected_services?: BookingServiceResponseDto[];
  services_total_amount?: number;
  subtotal_amount?: number; // total_price + services_total_amount
  voucher_id?: string;
  voucher_code?: string;
  voucher_discount_amount?: number;
  voucher_discount_percent?: number;
  discount_amount?: number;
  amount_after_discount?: number; // subtotal_amount - discount_amount
  service_fee?: number; // 10% của amount_after_discount
  tax_amount?: number; // 8% của amount_after_discount
  final_amount?: number; // amount_after_discount + service_fee + tax_amount
  commissionRate?: number;
  finalPayoutAmount?: number;
  status?: string;
  payment_status?: string;
  payment_method?: string;
  vnpay_order_id?: string;
  momo_order_id?: string;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  special_requests?: string;
  created_at?: Date;
  updated_at?: Date;
  cancel_policy?: string;
  payment_id?: string;
  vnpay_pay_date?: Date;
  outstanding_amount?: number;
  deposit_paid_amount?: number; // Thêm trường này

  // Note and additional cost fields
  note?: string;
  additionalCost?: number;
  additionalCostReason?: string;

  // Cancellation details
  cancelled_at?: Date;
  cancellationDetails?: {
    accountName?: string;
    bankName?: string;
    accountNumber?: string;
    cancellationReason?: string;
    refundMethod?: string;
    refundNote?: string;
  };
  cancellationDetailsUpdatedAt?: Date;
  cancellationDetailsUpdatedBy?: string;
}
