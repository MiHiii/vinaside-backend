# Booking Statistics Filter Fix

## Vấn đề

Các endpoint thống kê booking đang bao gồm cả các booking có `status = pending` và `payment_status = unpaid`, điều này làm cho thống kê không chính xác vì những booking này chưa được xác nhận hoặc thanh toán.

## Giải pháp

Loại trừ tất cả booking có `status = pending` và `payment_status = unpaid` khỏi tất cả các endpoint thống kê.

## Thay đổi

### 1. Sửa Filter Methods

#### `createStatisticsFilter()`

```typescript
// Trước
const filter: any = { isDeleted: false };

// Sau
const filter: any = {
  isDeleted: false,
  // Loại trừ booking pending và unpaid
  $nor: [{ status: 'pending', payment_status: 'unpaid' }],
};
```

#### `createStatisticsFilterWithMultipleProperties()`

```typescript
// Trước
const filter: any = { isDeleted: false };

// Sau
const filter: any = {
  isDeleted: false,
  // Loại trừ booking pending và unpaid
  $nor: [{ status: 'pending', payment_status: 'unpaid' }],
};
```

### 2. Các Endpoint Thống Kê Đã Được Sửa

#### Overview Statistics (`getOverviewStatistics`)

- ✅ Thống kê tổng quan
- ✅ Thống kê theo trạng thái
- ✅ Thống kê theo trạng thái thanh toán
- ✅ Thống kê voucher
- ✅ Thống kê services
- ✅ Top services used
- ✅ Chart data

#### Financial Statistics (`getFinancialStatistics`)

- ✅ Thống kê tài chính tổng quan
- ✅ Thống kê doanh thu theo tháng
- ✅ Additional financial metrics

#### Customer Statistics (`getCustomerStatistics`)

- ✅ Thống kê khách hàng
- ✅ Thống kê khách hàng mới vs quay lại
- ✅ Voucher usage by customers
- ✅ Services usage by customers

#### Timeline Statistics (`getTimelineStatistics`)

- ✅ Thống kê theo ngày
- ✅ Thống kê theo tuần
- ✅ Thống kê theo tháng
- ✅ Tính thời gian đặt trước trung bình

#### Voucher Statistics (`getVoucherStatistics`)

- ✅ Thống kê voucher tổng quan

#### Services Statistics (`getServicesStatistics`)

- ✅ Thống kê services tổng quan
- ✅ Top services used

#### Services by User (`getServicesByUserStatistics`)

- ✅ Thống kê services theo user

#### Vouchers by User (`getVouchersByUserStatistics`)

- ✅ Thống kê voucher theo user

#### Calendar Management

- ✅ `getCalendarData()` - Lấy dữ liệu calendar
- ✅ `getDayBookings()` - Lấy booking theo ngày

#### Booking Details

- ✅ `getBookingDetails()` - Lấy chi tiết booking
- ✅ `getBookingsByVoucher()` - Lấy booking theo voucher
- ✅ `getBookingsByService()` - Lấy booking theo service

### 3. Logic Filter

Sử dụng MongoDB `$nor` operator để loại trừ booking có cả hai điều kiện:

- `status = 'pending'`
- `payment_status = 'unpaid'`

```typescript
$nor: [{ status: 'pending', payment_status: 'unpaid' }];
```

Điều này có nghĩa là:

- ✅ Booking `pending` + `partially_paid` → **Được tính**
- ✅ Booking `pending` + `paid` → **Được tính**
- ✅ Booking `confirmed` + `unpaid` → **Được tính**
- ❌ Booking `pending` + `unpaid` → **Không được tính**

## Impact

### Trước khi sửa

- Thống kê bao gồm cả booking chưa xác nhận và chưa thanh toán
- Số liệu không chính xác
- Doanh thu bị tính sai

### Sau khi sửa

- ✅ Chỉ tính booking đã xác nhận hoặc đã thanh toán
- ✅ Số liệu thống kê chính xác hơn
- ✅ Doanh thu phản ánh đúng thực tế
- ✅ Tỉ lệ lấp đầy chính xác hơn

## Testing

### Test Cases

1. **Booking pending + unpaid** → Không xuất hiện trong thống kê
2. **Booking pending + paid** → Xuất hiện trong thống kê
3. **Booking confirmed + unpaid** → Xuất hiện trong thống kê
4. **Booking confirmed + paid** → Xuất hiện trong thống kê

### Expected Results

- Tổng số booking giảm (loại trừ pending + unpaid)
- Doanh thu chính xác hơn
- Tỉ lệ lấp đầy thực tế hơn
- Thống kê khách hàng chính xác hơn

## Files Modified

### `src/modules/booking/booking.service.ts`

- `createStatisticsFilter()`
- `createStatisticsFilterWithMultipleProperties()`
- `getOverviewStatistics()`
- `getFinancialStatistics()`
- `getCustomerStatistics()`
- `getTimelineStatistics()`
- `getVoucherStatistics()`
- `getServicesStatistics()`
- `getServicesByUserStatistics()`
- `getVouchersByUserStatistics()`
- `getCalendarData()`
- `getDayBookings()`
- `getBookingDetails()`
- `getBookingsByVoucher()`
- `getBookingsByService()`

## Related Issues

- **Booking Statistics Accuracy**: Đảm bảo thống kê chỉ tính booking hợp lệ
- **Revenue Calculation**: Doanh thu chỉ tính từ booking đã xác nhận/thanh toán
- **Occupancy Rate**: Tỉ lệ lấp đầy chính xác hơn

## Notes

- Filter này áp dụng cho tất cả endpoint thống kê
- Không ảnh hưởng đến các endpoint CRUD booking
- Booking pending + unpaid vẫn có thể được xem trong danh sách booking thông thường
- Chỉ loại trừ khỏi các báo cáo thống kê
