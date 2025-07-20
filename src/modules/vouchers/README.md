# Voucher Module - Tính năng Min Order Value & Max Uses Per User

## Tổng quan

Module voucher đã được mở rộng với tính năng **Min Order Value** (Giá trị đơn hàng tối thiểu) và **Max Uses Per User** (Giới hạn sử dụng mỗi user) để tăng giá trị đơn hàng trung bình và kiểm soát việc sử dụng voucher.

## Tính năng mới

### 1. Trường `max_uses_per_user`

- **Mô tả**: Số lần tối đa mỗi user có thể sử dụng voucher
- **Kiểu dữ liệu**: Number
- **Mặc định**: 1 (mỗi user chỉ được sử dụng 1 lần)
- **Validation**: 1 (cố định)

### 2. Trường `min_order_value`

- **Mô tả**: Giá trị đơn hàng tối thiểu (VND) để voucher có thể được áp dụng
- **Kiểu dữ liệu**: Number
- **Mặc định**: 0 (không có yêu cầu)
- **Validation**: >= 0

### 3. Logic hoạt động

Khi khách hàng nhập mã voucher, hệ thống sẽ kiểm tra:

1. **Điều kiện cơ bản:**

   - Voucher còn hoạt động
   - Chưa hết hạn
   - Chưa hết lượt sử dụng

2. **Điều kiện mới - Max Uses Per User:**

   ```typescript
   if (userId && voucher.max_uses_per_user && voucher.max_uses_per_user > 0) {
     const userUsageCount = await this.voucherRepo.getUserUsageCount(
       String(voucher._id),
       userId,
     );
     if (userUsageCount >= voucher.max_uses_per_user) {
       return {
         valid: false,
         message: `Bạn đã sử dụng voucher này ${voucher.max_uses_per_user} lần (tối đa)`,
       };
     }
   }
   ```

3. **Điều kiện mới - Min Order Value:**
   ```typescript
   if (voucher.min_order_value && voucher.min_order_value > 0) {
     if (totalAmount < voucher.min_order_value) {
       return {
         valid: false,
         message: `Đơn hàng phải có giá trị tối thiểu ${voucher.min_order_value.toLocaleString('vi-VN')} VND để sử dụng voucher này`,
       };
     }
   }
   ```

### 4. API Endpoints mới

#### GET `/vouchers/:id/min-order-info`

Lấy thông tin chi tiết về min_order_value của voucher

**Response:**

```json
{
  "voucher": {
    /* voucher object */
  },
  "minOrderValue": 1000000,
  "hasMinOrderRequirement": true,
  "formattedMinOrderValue": "1,000,000 VND"
}
```

#### GET `/vouchers/by-min-order-range?min_value=500000&max_value=2000000`

Lấy danh sách voucher theo khoảng giá trị đơn hàng tối thiểu

### 5. Thống kê mới

Thống kê bao gồm thông tin về min_order_value:

```typescript
minOrderValueAnalysis: {
  vouchersWithMinOrder: number;        // Số voucher có yêu cầu min order
  vouchersWithoutMinOrder: number;     // Số voucher không có yêu cầu
  averageMinOrderValue: number;        // Giá trị trung bình
  maxMinOrderValue: number;            // Giá trị cao nhất
  byValueRanges: any[];                // Phân tích theo khoảng giá
}
```

## Cách sử dụng

### 1. Tạo voucher với max_uses_per_user và min_order_value

```json
POST /vouchers
{
  "code": "SUMMER2024",
  "discount_percent": 20,
  "max_uses": 100,
  "expiration_date": "2024-12-31",
  "max_uses_per_user": 1,
  "min_order_value": 1000000,
  "description": "Giảm 20% cho đơn hàng từ 1 triệu VND (mỗi user chỉ được sử dụng 1 lần)"
}
```

### 2. Validate voucher với max_uses_per_user

```typescript
// User đã sử dụng voucher này 1 lần - KHÔNG hợp lệ
const result = await validateVoucher(
  'SUMMER2024',
  1200000,
  null,
  null,
  'user123',
);
// result.valid = false
// result.message = "Bạn đã sử dụng voucher này 1 lần (tối đa)"

// User chưa sử dụng voucher - HỢP LỆ
const result = await validateVoucher(
  'SUMMER2024',
  1200000,
  null,
  null,
  'user456',
);
// result.valid = true
// result.discount_amount = 240000

// Đơn hàng 800,000 VND - KHÔNG hợp lệ (min order value)
const result = await validateVoucher('SUMMER2024', 800000);
// result.valid = false
// result.message = "Đơn hàng phải có giá trị tối thiểu 1,000,000 VND để sử dụng voucher này"

// Đơn hàng 1,200,000 VND - HỢP LỆ
const result = await validateVoucher('SUMMER2024', 1200000);
// result.valid = true
// result.discount_amount = 240000
```

## Lợi ích

1. **Kiểm soát việc sử dụng voucher**: Mỗi user chỉ được sử dụng voucher 1 lần, tránh lạm dụng
2. **Tăng giá trị đơn hàng trung bình**: Khuyến khích khách đặt phòng có giá trị cao hơn
3. **Tối ưu hóa chi phí**: Giảm thiểu việc áp dụng voucher cho đơn hàng nhỏ
4. **Chiến lược marketing linh hoạt**: Có thể tạo voucher cho các segment khách hàng khác nhau
5. **Báo cáo chi tiết**: Theo dõi hiệu quả của voucher theo giá trị đơn hàng và số lượng user sử dụng

## Migration

Nếu bạn đang sử dụng database cũ, trường `min_order_value` sẽ được tự động thêm với giá trị mặc định là 0, và `max_uses_per_user` sẽ được đặt mặc định là 1, đảm bảo tương thích ngược.

## Validation Rules

- `max_uses_per_user = 1` (cố định)
- `min_order_value >= 0`
- Nếu `min_order_value = 0` hoặc `null`: Không có yêu cầu giá trị tối thiểu
- Nếu `min_order_value > 0`: Đơn hàng phải >= giá trị này để sử dụng voucher
