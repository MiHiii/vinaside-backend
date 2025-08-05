# Staff Booking và Weekend Surcharge Features

## Tổng quan

Đã thêm các tính năng mới cho nhân viên:

- **Staff Booking API**: Cho phép nhân viên tạo booking cho khách hàng
- **Weekend Surcharge**: Tính phí cuối tuần tự động từ listing
- **Staff Remaining Payment**: Cho phép nhân viên thanh toán phần còn lại cho guest
- **Listing Status Check**: Kiểm tra trạng thái listing cho khách hàng

## Các trường mới trong Listing Schema

### Weekend Surcharge Fields

```typescript
has_weekend_surcharge?: boolean; // Có áp dụng phí cuối tuần không
weekend_surcharge_percent?: number; // Phần trăm phí cuối tuần (0-100)
```

### Listing Status

```typescript
export enum ListingStatus {
  ACTIVE = 'active', // Phòng đang hoạt động và hiển thị
  INACTIVE = 'inactive', // Tạm ngưng hiển thị
  DRAFT = 'draft', // Đang tạo nhưng chưa public
}
```

## API Endpoints

### 1. Tạo booking cho nhân viên

```http
POST /bookings/staff/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "propertyId": "property_id",
  "listingId": "listing_id",
  "guestId": "guest_id", // Optional
  "checkInDate": "2024-02-15",
  "checkOutDate": "2024-02-17",
  "guests": 2,
  "infants": 0,
  "guest_name": "Nguyễn Văn A",
  "guest_email": "guest@example.com",
  "guest_phone": "0123456789",
  "specialRequests": "Yêu cầu đặc biệt",
  "voucherCode": "SUMMER2024", // Optional
  "note": "Ghi chú cho booking",
  "additionalCost": 50000, // Optional
  "additionalCostReason": "Phí dọn dẹp thêm",
  "status": "confirmed", // Optional
  "payment_status": "unpaid", // Optional
  "price_per_night": 800000, // Optional - override giá listing
  "final_amount": 2000000, // Optional - override tổng tiền
  "skip_availability_check": false, // Optional
  "services": [
    {
      "serviceId": "service_id",
      "quantity": 2
    }
  ]
}
```

### 2. Cập nhật weekend surcharge cho listing

```http
PATCH /listings/:listingId
Authorization: Bearer <token>
Content-Type: application/json

{
  "has_weekend_surcharge": true,
  "weekend_surcharge_percent": 20
}
```

### 3. Nhân viên thanh toán phần còn lại cho guest

```http
POST /bookings/:propertyId/:id/payment/remaining/staff
Authorization: Bearer <token>
Content-Type: application/json

{
  "paymentMethod": "vnpay",
  "returnUrl": "https://example.com/payment/return",
  "cancelUrl": "https://example.com/payment/cancel"
}
```

## Tính năng chính

### 1. Staff Booking API

- **Quyền truy cập**: Chỉ admin và staff được assign cho property
- **Tạo booking cho khách**: Staff có thể tạo booking cho khách hàng
- **Override giá**: Có thể set giá tùy chỉnh thay vì giá listing
- **Skip availability check**: Bỏ qua kiểm tra trùng lịch
- **Tự động tính toán**: Tính tất cả phí, discount, surcharge
- **Weekend surcharge tự động**: Tự động tính từ listing
- **Listing status check**: Staff có thể tạo booking cho listing ở bất kỳ trạng thái nào

### 2. Weekend Surcharge (Quản lý ở Listing)

- **Quản lý ở listing**: Weekend surcharge được set ở listing level
- **Tự động tính**: Tự động tính khi tạo booking dựa trên listing
- **Phần trăm**: Chỉ sử dụng phần trăm (0-100%)
- **Hiển thị cho KH**: Khách hàng thấy phí cuối tuần ngay từ đầu

### 3. Staff Remaining Payment

- **Quyền truy cập**: Chỉ admin và staff được assign cho property
- **Thanh toán cho guest**: Nhân viên có thể tạo thanh toán phần còn lại cho guest
- **Tự động tính số tiền**: Tự động tính số tiền còn lại cần thanh toán
- **Notification**: Tự động gửi thông báo cho guest
- **Validation**: Kiểm tra trạng thái booking và quyền truy cập

### 4. Listing Status Check

- **Guest chỉ xem listing active**: Khách hàng chỉ có thể xem và tương tác với listing có trạng thái `active`
- **Staff xem tất cả trạng thái**: Nhân viên có thể xem và tạo booking cho listing ở bất kỳ trạng thái nào
- **Availability check**: Kiểm tra trạng thái listing khi check availability
- **Top listings**: Chỉ trả về listing active cho các API top listings

## Cách tính Weekend Surcharge

```typescript
// Ví dụ: Check-in 2024-02-15 (Thứ 5), Check-out 2024-02-17 (Thứ 7)
// Weekend days: 1 (Thứ 7)
// Price per night: 500,000đ
// Weekend surcharge percent: 20%

weekendDays = 1; // Số ngày cuối tuần
weekendSurcharge = (500000 * 1 * 20) / 100 = 100,000đ
```

## Quyền truy cập

### Staff Booking

- `booking.create` permission
- Staff chỉ có thể tạo booking cho property được assign
- Admin có thể tạo booking cho tất cả property

### Listing Weekend Surcharge

- `listing.update` permission
- Chỉ admin và staff được assign mới có thể cập nhật

### Staff Remaining Payment

- `booking.update` permission
- Staff chỉ có thể thanh toán cho property được assign
- Admin có thể thanh toán cho tất cả property

### Listing Status Check

- **Guest**: Chỉ có thể xem và tương tác với listing `active`
- **Staff**: Có thể xem và tương tác với listing ở tất cả trạng thái
- **Admin**: Có thể xem và tương tác với listing ở tất cả trạng thái

## Response Format

### Tạo booking thành công

```json
{
  "success": true,
  "message": "Tạo booking thành công",
  "data": {
    "_id": "booking_id",
    "propertyId": "property_id",
    "listingId": "listing_id",
    "guestId": "guest_id",
    "checkInDate": "2024-02-15T00:00:00.000Z",
    "check_out_date": "2024-02-17T00:00:00.000Z",
    "guests": 2,
    "infants": 0,
    "nights": 2,
    "price_per_night": 500000,
    "total_price": 1000000,
    "final_amount": 1500000,
    "status": "confirmed",
    "payment_status": "unpaid",
    "guest_name": "Nguyễn Văn A",
    "guest_email": "guest@example.com",
    "note": "Khách hàng VIP",
    "additionalCost": 50000,
    "additionalCostReason": "Phí dọn dẹp thêm"
  }
}
```

### Listing với weekend surcharge

```json
{
  "success": true,
  "data": {
    "_id": "listing_id",
    "title": "Phòng Deluxe",
    "price_per_night": 500000,
    "has_weekend_surcharge": true,
    "weekend_surcharge_percent": 20
  }
}
```

### Thanh toán phần còn lại thành công

```json
{
  "success": true,
  "paymentMethod": "vnpay",
  "paymentUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=1500000&vnp_Command=pay&vnp_CurrCode=VND&vnp_IpAddr=127.0.0.1&vnp_Locale=vn&vnp_OrderInfo=Thanh+toan+phan+con+lai&vnp_OrderType=other&vnp_ReturnUrl=https%3A%2F%2Fexample.com%2Fpayment%2Freturn&vnp_TmnCode=TMNX&vnp_TxnRef=1234567890&vnp_Version=2.1.0&vnp_SecureHash=abc123",
  "orderId": "1234567890",
  "amount": 1500000,
  "message": "Tạo payment URL thành công",
  "expiresAt": "2024-02-15T10:30:00.000Z",
  "createdAt": "2024-02-15T10:00:00.000Z"
}
```

### Listing không active (Guest)

```json
{
  "success": false,
  "message": "Listing with ID listing_id not found."
}
```

## Validation Rules

### Staff Booking

- `propertyId`, `listingId`, `checkInDate`, `checkOutDate`: Required
- `guests`: Required, min: 1
- `guest_name`, `guest_email`: Required
- `checkOutDate` > `checkInDate`
- `price_per_night`, `final_amount`: min: 0

### Listing Weekend Surcharge

- `weekend_surcharge_percent`: 0-100

### Staff Remaining Payment

- `paymentMethod`: Required, phải là method được hỗ trợ
- `returnUrl`: Required
- Booking phải tồn tại và thuộc property được assign
- Booking phải có số tiền còn lại cần thanh toán
- Booking phải ở trạng thái cho phép thanh toán

### Listing Status Check

- **Guest booking**: Chỉ có thể tạo booking cho listing `active`
- **Guest availability**: Chỉ có thể check availability cho listing `active`
- **Guest view**: Chỉ có thể xem thông tin listing `active`
- **Staff booking**: Có thể tạo booking cho listing ở bất kỳ trạng thái nào
- **Staff view**: Có thể xem thông tin listing ở bất kỳ trạng thái nào

## Error Cases

### Permission Errors

```json
{
  "success": false,
  "message": "Bạn không có quyền tạo booking cho property này"
}
```

```json
{
  "success": false,
  "message": "Chỉ admin và staff mới có thể thanh toán cho guest"
}
```

### Validation Errors

```json
{
  "success": false,
  "message": "Check-out date phải sau check-in date"
}
```

```json
{
  "success": false,
  "message": "Không còn số tiền nào cần thanh toán"
}
```

### Listing Status Errors

```json
{
  "success": false,
  "message": "Listing with ID listing_id not found."
}
```

```json
{
  "success": false,
  "message": "Listing không tồn tại hoặc không active."
}
```

### Availability Errors

```json
{
  "success": false,
  "message": "Phòng đã được đặt trong khoảng thời gian này"
}
```

## Lưu ý

1. **Weekend Calculation**: Hệ thống tự động tính số ngày cuối tuần (Thứ 7, Chủ nhật)
2. **Listing Level**: Weekend surcharge được quản lý ở listing, không phải booking
3. **Auto Calculation**: Tự động tính weekend surcharge khi tạo booking
4. **UI Display**: Khách hàng thấy phí cuối tuần ngay từ đầu
5. **Price Override**: Staff có thể set giá khác với giá listing
6. **Skip Availability**: Có thể bỏ qua kiểm tra trùng lịch khi cần
7. **Audit Trail**: Ghi lại ai tạo booking và khi nào
8. **Staff Payment**: Nhân viên có thể thanh toán phần còn lại cho guest
9. **Auto Notification**: Tự động gửi thông báo cho guest khi staff tạo thanh toán
10. **Payment Validation**: Kiểm tra đầy đủ quyền và trạng thái booking
11. **Listing Status**: Guest chỉ xem listing active, staff xem tất cả trạng thái
12. **Availability Check**: Kiểm tra trạng thái listing khi check availability
13. **Top Listings**: Chỉ trả về listing active cho guest
14. **Staff Flexibility**: Staff có thể tạo booking cho listing ở bất kỳ trạng thái nào
