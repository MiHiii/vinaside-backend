# Voucher Module - Tính năng Min Order Value

## Tổng quan

Module voucher đã được mở rộng với tính năng **Min Order Value** (Giá trị đơn hàng tối thiểu) để tăng giá trị đơn hàng trung bình và khuyến khích khách hàng đặt phòng có giá trị cao hơn.

## Tính năng mới

### 1. Trường `min_order_value`

- **Mô tả**: Giá trị đơn hàng tối thiểu (VND) để voucher có thể được áp dụng
- **Kiểu dữ liệu**: Number
- **Mặc định**: 0 (không có yêu cầu)
- **Validation**: >= 0

### 2. Logic hoạt động

Khi khách hàng nhập mã voucher, hệ thống sẽ kiểm tra:

1. **Điều kiện cơ bản:**

   - Voucher còn hoạt động
   - Chưa hết hạn
   - Chưa hết lượt sử dụng

2. **Điều kiện mới - Min Order Value:**
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

### 3. API Endpoints mới

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

### 4. Thống kê mới

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

### 1. Tạo voucher với min_order_value

```json
POST /vouchers
{
  "code": "SUMMER2024",
  "discount_percent": 20,
  "max_uses": 100,
  "expiration_date": "2024-12-31",
  "min_order_value": 1000000,
  "description": "Giảm 20% cho đơn hàng từ 1 triệu VND"
}
```

### 2. Validate voucher

```typescript
// Đơn hàng 800,000 VND - KHÔNG hợp lệ
const result = await validateVoucher('SUMMER2024', 800000);
// result.valid = false
// result.message = "Đơn hàng phải có giá trị tối thiểu 1,000,000 VND để sử dụng voucher này"

// Đơn hàng 1,200,000 VND - HỢP LỆ
const result = await validateVoucher('SUMMER2024', 1200000);
// result.valid = true
// result.discount_amount = 240000
```

## Lợi ích

1. **Tăng giá trị đơn hàng trung bình**: Khuyến khích khách đặt phòng có giá trị cao hơn
2. **Tối ưu hóa chi phí**: Giảm thiểu việc áp dụng voucher cho đơn hàng nhỏ
3. **Chiến lược marketing linh hoạt**: Có thể tạo voucher cho các segment khách hàng khác nhau
4. **Báo cáo chi tiết**: Theo dõi hiệu quả của voucher theo giá trị đơn hàng

## Migration

Nếu bạn đang sử dụng database cũ, trường `min_order_value` sẽ được tự động thêm với giá trị mặc định là 0, đảm bảo tương thích ngược.

## Validation Rules

- `min_order_value >= 0`
- Nếu `min_order_value = 0` hoặc `null`: Không có yêu cầu giá trị tối thiểu
- Nếu `min_order_value > 0`: Đơn hàng phải >= giá trị này để sử dụng voucher
