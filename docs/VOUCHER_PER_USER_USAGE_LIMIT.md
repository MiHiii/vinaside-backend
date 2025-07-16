# Voucher Per-User Usage Limit Feature

## Tổng quan

Tính năng **Per-User Usage Limit** cho phép giới hạn số lần mỗi user có thể sử dụng một voucher cụ thể. Điều này giúp:

- Tránh lạm dụng voucher bởi một user duy nhất
- Phân phối voucher công bằng cho nhiều user
- Kiểm soát chi phí marketing hiệu quả
- Phù hợp với tính chất business booking phòng (user có thể đặt nhiều lần)

1. Separation of Concerns (Tách biệt dữ liệu)
- Voucher Schema: Chứa thông tin tĩnh về voucher
Code, discount_percent, expiration_date, max_uses...
Thông tin này ít thay đổi
- VoucherUsage Schema: Chứa thông tin động về việc sử dụng
Ai sử dụng, khi nào, booking nào, số tiền...
Thông tin này tăng liên tục

## Cấu trúc Database

### 1. Voucher Schema (Updated)

```typescript
@Schema()
export class Voucher {
  // ... existing fields ...

  @Prop({
    type: Number,
    required: false,
    default: 3,
    min: 1,
    max: 10,
  })
  max_uses_per_user?: number;
}
```

### 2. VoucherUsage Schema (New)

```typescript
@Schema()
export class VoucherUsage {
  voucher_id: ObjectId; // Reference to voucher
  user_id: ObjectId; // Reference to user
  booking_id: ObjectId; // Reference to booking
  discount_amount: number; // Discount amount applied
  order_amount: number; // Total order amount
  used_at: Date; // When voucher was used
}
```

## API Endpoints

### 1. Validate Voucher (Updated)

```
GET /vouchers/validate/:code
```

**Query Parameters:**

- `total_amount`: Tổng tiền đơn hàng
- `listing_id`: ID phòng (optional)
- `property_id`: ID property (optional)

**Authentication:** Required (để lấy userId)

**Response:**

```json
{
  "valid": true,
  "voucher": { ... },
  "message": "Mã voucher hợp lệ",
  "discount_amount": 150000
}
```

**Error Cases:**

```json
{
  "valid": false,
  "message": "Bạn đã sử dụng voucher này 3 lần (tối đa)"
}
```

### 2. Get User Usage History

```
GET /vouchers/:id/usage-history/:userId
```

**Response:**

```json
{
  "data": [
    {
      "voucher_id": "...",
      "user_id": "...",
      "booking_id": "...",
      "discount_amount": 150000,
      "order_amount": 1000000,
      "used_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### 3. Get Voucher Usage Statistics

```
GET /vouchers/:id/usage-stats
```

**Response:**

```json
{
  "totalUsage": 25,
  "uniqueUsers": 15,
  "averageUsagePerUser": 1.67
}
```

### 4. Check Voucher for Booking

```
GET /vouchers/:id/check-booking/:bookingId
```

**Response:**

```json
{
  "isUsed": true
}
```

## Workflow

### 1. User Validation Flow

```
1. User nhập voucher code
2. System gọi validateVoucher với userId
3. System checks:
   - Voucher exists & active
   - Not expired
   - Total uses < max_uses
   - User uses < max_uses_per_user (NEW)
   - Min order value satisfied
   - Property/room applicability
4. Return validation result
```

### 2. Voucher Usage Flow

```
1. User completes booking
2. System calls useVoucher with tracking data
3. System:
   - Increments voucher.uses_count
   - Creates VoucherUsage record
   - Tracks discount and order amounts
4. Return updated voucher
```

## Configuration

### Default Settings

```typescript
// Voucher creation defaults
{
  max_uses_per_user: 3,     // 3 lần mỗi user
  max_uses: 100,            // 100 lần tổng cộng
  min_order_value: 0,       // Không giới hạn
  expiration_date: required // Bắt buộc
}
```

### Recommended Settings by Use Case

#### Flash Sale Vouchers

```typescript
{
  max_uses_per_user: 1,     // 1 lần duy nhất
  max_uses: 1000,           // Nhiều user
  expiration_date: +24h     // Ngắn hạn
}
```

#### Loyalty Program

```typescript
{
  max_uses_per_user: 5,     // 5 lần cho VIP
  max_uses: 500,            // Ít user hơn
  expiration_date: +365d    // Dài hạn
}
```

#### Booking Campaign

```typescript
{
  max_uses_per_user: 3,     // 3 lần booking
  max_uses: 200,            // Vừa phải
  expiration_date: +90d     // Theo mùa
}
```

## Business Benefits

### 1. Fairness & Distribution

- **Tránh monopoly**: Một user không thể sử dụng hết voucher
- **Wider reach**: Nhiều user được hưởng lợi
- **Better engagement**: Khuyến khích user quay lại

### 2. Cost Control

- **Predictable costs**: Biết được chi phí tối đa per user
- **Budget allocation**: Phân bổ ngân sách marketing hiệu quả
- **ROI tracking**: Theo dõi hiệu quả per user

### 3. User Experience

- **Booking flexibility**: User có thể đặt nhiều lần
- **Family usage**: Phù hợp cho gia đình đông người
- **Repeat business**: Khuyến khích loyalty

## Migration Guide

### Existing Vouchers

- Vouchers cũ sẽ có `max_uses_per_user = 3` (default)
- Không ảnh hưởng đến functionality hiện tại
- Có thể update theo nhu cầu

### Database Migration

```sql
-- Vouchers table already updated via schema
-- VoucherUsage table will be created automatically
-- Existing data không bị ảnh hưởng
```

## Monitoring & Analytics

### Key Metrics

- **Usage distribution**: Phân bổ sử dụng giữa các user
- **Redemption rate**: Tỷ lệ sử dụng voucher
- **User retention**: User quay lại sử dụng voucher
- **Revenue per user**: Doanh thu trung bình per user

### Reports

- Top users by voucher usage
- Voucher effectiveness by user segment
- Usage patterns over time
- Cost analysis per voucher campaign

## Technical Notes

### Performance Considerations

- Indexed queries on `voucher_id + user_id`
- Efficient counting with `countDocuments()`
- Cached validation results (optional)

### Error Handling

- Graceful degradation nếu không có userId
- Clear error messages cho user
- Logging cho debugging

### Security

- User authentication required
- Authorization checks cho admin endpoints
- Input validation cho all parameters
