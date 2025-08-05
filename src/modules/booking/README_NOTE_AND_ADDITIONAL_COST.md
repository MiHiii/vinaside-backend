# Booking Note và Additional Cost Features

## Tổng quan

Đã thêm các tính năng mới vào booking để nhân viên có thể:

- Ghi chú thông tin cho booking
- Quản lý chi phí phát sinh
- Lưu thông tin chi tiết khi hủy phòng

## Các trường mới trong Booking Schema

### 1. Note Fields

```typescript
note?: string; // Ghi chú thông thường cho booking
```

### 2. Additional Cost Fields

```typescript
additionalCost?: number; // Chi phí phát sinh
additionalCostReason?: string; // Lý do chi phí phát sinh
```

### 3. Cancellation Details Fields

```typescript
cancellationDetails?: {
  accountName?: string; // Tên chủ tài khoản
  bankName?: string; // Tên ngân hàng
  accountNumber?: string; // Số tài khoản
  cancellationReason?: string; // Lý do hủy
  refundMethod?: string; // Phương thức hoàn tiền
  refundNote?: string; // Ghi chú hoàn tiền
};
cancellationDetailsUpdatedAt?: Date; // Thời gian cập nhật
cancellationDetailsUpdatedBy?: Types.ObjectId; // Người cập nhật
```

## API Endpoints

### 1. Cập nhật ghi chú

```http
PATCH /bookings/:propertyId/:id/note
Authorization: Bearer <token>
Content-Type: application/json

{
  "note": "Khách hàng rất hài lòng với dịch vụ"
}
```

### 2. Cập nhật chi phí phát sinh

```http
PATCH /bookings/:propertyId/:id/additional-cost
Authorization: Bearer <token>
Content-Type: application/json

{
  "additionalCost": 50000,
  "additionalCostReason": "Phí dọn dẹp thêm"
}
```

### 3. Cập nhật thông tin hủy phòng

```http
PATCH /bookings/:propertyId/:id/cancellation-details
Authorization: Bearer <token>
Content-Type: application/json

{
  "accountName": "Nguyễn Văn A",
  "bankName": "Vietcombank",
  "accountNumber": "1234567890",
  "cancellationReason": "Khách hủy do lý do cá nhân",
  "refundMethod": "Chuyển khoản",
  "refundNote": "Đã hoàn tiền 100%"
}
```

### 4. Lấy thông tin hủy phòng

```http
GET /bookings/:propertyId/:id/cancellation-details
Authorization: Bearer <token>
```

## Cách sử dụng

### 1. Ghi chú thông thường

- Dùng để lưu thông tin về khách hàng, yêu cầu đặc biệt, feedback
- Ví dụ: "Khách hàng rất hài lòng", "Khách yêu cầu dọn phòng sớm"

### 2. Chi phí phát sinh

- Khi có thêm chi phí ngoài dự kiến (dọn dẹp, sửa chữa, v.v.)
- Hệ thống sẽ tự động tính lại `final_amount`
- Ví dụ: Phí dọn dẹp thêm 50,000đ

### 3. Thông tin hủy phòng

- Lưu thông tin ngân hàng để hoàn tiền
- Ghi lại lý do hủy và phương thức hoàn tiền
- Theo dõi ai cập nhật và khi nào

## Quyền truy cập

Tất cả các endpoint đều yêu cầu:

- `booking.update` permission để cập nhật
- `booking.view` permission để xem
- Staff chỉ có thể truy cập booking của property được assign

## Response Format

### Cập nhật thành công

```json
{
  "success": true,
  "message": "Cập nhật thành công",
  "data": {
    "_id": "booking_id",
    "note": "Ghi chú mới",
    "additionalCost": 50000,
    "additionalCostReason": "Lý do",
    "final_amount": 1500000
    // ... other booking fields
  }
}
```

### Lấy thông tin hủy phòng

```json
{
  "success": true,
  "data": {
    "cancellationDetails": {
      "accountName": "Nguyễn Văn A",
      "bankName": "Vietcombank",
      "accountNumber": "1234567890",
      "cancellationReason": "Lý do hủy",
      "refundMethod": "Chuyển khoản",
      "refundNote": "Ghi chú hoàn tiền"
    },
    "cancellationDetailsUpdatedAt": "2024-01-01T10:00:00.000Z",
    "cancellationDetailsUpdatedBy": "user_id"
  }
}
```

## Lưu ý

1. **Chi phí phát sinh**: Khi cập nhật `additionalCost`, hệ thống sẽ tự động tính lại `final_amount`
2. **Audit trail**: Tất cả thay đổi đều được ghi lại người thực hiện và thời gian
3. **Permission**: Staff chỉ có thể truy cập booking của property được assign
4. **Validation**: Tất cả input đều được validate theo DTO
