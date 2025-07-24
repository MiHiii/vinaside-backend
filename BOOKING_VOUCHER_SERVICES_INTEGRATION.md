# Tích hợp Voucher và Services vào Booking

## Tổng quan

Module booking đã được tích hợp với voucher và services để:

- Tính toán giá tiền đặt phòng bao gồm các dịch vụ bổ sung
- Áp dụng mã giảm giá (voucher) để giảm giá
- Theo dõi việc sử dụng voucher và services của từng user
- Trả về thông tin chi tiết về giá tiền theo cấu trúc mong muốn

## Cấu trúc dữ liệu mới

### Booking Schema đã được cập nhật với các trường mới:

```typescript
// Voucher fields
voucher_id?: Types.ObjectId;
voucher_code?: string;
voucher_discount_amount?: number;
voucher_discount_percent?: number;

// Services fields
selected_services?: Array<{
  service_id: Types.ObjectId;
  service_name: string;
  service_price: number;
  quantity: number;
  total_price: number;
}>;

// Price calculation fields
services_total_amount?: number;
subtotal_amount?: number; // total_price + services_total_amount
discount_amount?: number;
amount_after_discount?: number; // subtotal_amount - discount_amount
```

### DTO mới

#### CreateBookingDto

```typescript
export class CreateBookingDto {
  // ... existing fields
  voucherCode?: string; // Mã voucher
  services?: BookingServiceDto[]; // Danh sách services
}

export class BookingServiceDto {
  serviceId: string; // ID của service
  quantity: number; // Số lượng
}
```

#### BookingResponseDto

```typescript
export class BookingResponseDto {
  _id: string;
  // ... existing fields
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
}
```

## Logic tính toán giá tiền

### 1. Giá phòng cơ bản

```
total_price = price_per_night * nights
```

### 2. Tổng tiền services

```
services_total_amount = sum(service_price * quantity) for all services
```

### 3. Subtotal (trước khi giảm giá)

```
subtotal_amount = total_price + services_total_amount
```

### 4. Áp dụng voucher

```
discount_amount = voucher_discount_amount
amount_after_discount = subtotal_amount - discount_amount
```

### 5. Tính phí và thuế

```
service_fee = amount_after_discount * 0.1 (10%)
tax_amount = amount_after_discount * 0.08 (8%)
```

### 6. Tổng tiền cuối cùng

```
final_amount = amount_after_discount + service_fee + tax_amount
```

## API Endpoints

### Tạo booking mới với voucher và services

```http
POST /bookings
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN

{
  "propertyId": "property_id",
  "listingId": "listing_id",
  "checkInDate": "2025-07-21",
  "checkOutDate": "2025-07-25",
  "guests": 1,
  "infants": 0,
  "specialRequests": "Yêu cầu đặc biệt",
  "voucherCode": "SUMMER2024",
  "services": [
    {
      "serviceId": "service_id_1",
      "quantity": 2
    },
    {
      "serviceId": "service_id_2",
      "quantity": 1
    }
  ]
}
```

### Response mẫu

```json
{
  "_id": "6878c392aceff758ed2b2f1a",
  "propertyId": "68724f541a705725e8919900",
  "listingId": "6875e723e054cfa6144f3594",
  "guestId": "6873b8a332e4a0e91546f493",
  "checkInDate": "2025-07-21T00:00:00.000Z",
  "check_out_date": "2025-07-25T00:00:00.000Z",
  "guests": 1,
  "infants": 0,
  "nights": 4,
  "price_per_night": 800000,
  "total_price": 3200000,
  "selected_services": [
    {
      "service_id": "service_id_here",
      "service_name": "Dịch vụ dọn phòng",
      "service_price": 100000,
      "quantity": 2,
      "total_price": 200000
    }
  ],
  "services_total_amount": 200000,
  "subtotal_amount": 3400000,
  "voucher_id": "voucher_id_here",
  "voucher_code": "SUMMER2024",
  "voucher_discount_amount": 340000,
  "voucher_discount_percent": 10,
  "discount_amount": 340000,
  "amount_after_discount": 3060000,
  "service_fee": 306000,
  "tax_amount": 244800,
  "final_amount": 3610800,
  "commissionRate": 0.1,
  "finalPayoutAmount": 2754000,
  "status": "pending",
  "payment_status": "pending",
  "guest_name": "User Name",
  "guest_email": "user@example.com",
  "guest_phone": "",
  "special_requests": "Yêu cầu đặc biệt",
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

## Validation

### Voucher Validation

- Kiểm tra voucher có tồn tại và còn hiệu lực
- Kiểm tra voucher có áp dụng cho property/listing này không
- Kiểm tra giá trị đơn hàng tối thiểu
- Kiểm tra số lần sử dụng còn lại
- Kiểm tra user đã sử dụng voucher này chưa

### Service Validation

- Kiểm tra service có tồn tại và còn active
- Kiểm tra quantity hợp lệ (> 0)

## Tracking

### Voucher Usage

- Tự động tạo record trong `voucher_usage` collection
- Lưu thông tin: voucher_id, user_id, booking_id, discount_amount, order_amount

### Service Usage

- Lưu thông tin services được chọn trong booking
- Bao gồm: service_id, service_name, service_price, quantity, total_price

## Các endpoint khác

### Lấy thông tin booking chi tiết

```http
GET /bookings/property/{propertyId}/{bookingId}
```

### Lấy danh sách bookings của tôi

```http
GET /bookings/my-bookings
```

### Lấy lịch sử booking

```http
GET /bookings/my-history
```

## Testing

Sử dụng file `test-booking-with-voucher-services.http` để test các trường hợp:

1. Tạo booking với voucher và services
2. Tạo booking không có voucher và services
3. Tạo booking chỉ có services
4. Tạo booking chỉ có voucher

## Lưu ý

1. **Voucher**: Phải được tạo trước trong hệ thống và có trạng thái active
2. **Services**: Phải được tạo trước trong hệ thống và có trạng thái active
3. **Permissions**: User phải có quyền tạo booking (role: guest)
4. **Availability**: Hệ thống vẫn kiểm tra tính khả dụng của listing trước khi tạo booking
5. **Email notifications**: Vẫn gửi email thông báo cho khách và staff như trước
