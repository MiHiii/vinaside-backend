# Calendar Management Feature

## Tổng quan

Đã implement thành công chức năng Calendar Management cho booking system với các tính năng:

### ✅ Đã hoàn thành

1. **Calendar Views**

   - Monthly view (mặc định)
   - Weekly view
   - Daily view

2. **Filter Options**

   - Property filter
   - Listing filter
   - Status filter
   - Payment status filter

3. **Role-based Access**

   - Admin: Xem tất cả bookings
   - Staff: Chỉ xem bookings của assigned properties

4. **API Endpoints**
   - `GET /bookings/calendar` - Lấy dữ liệu calendar
   - `GET /bookings/calendar/day/{date}` - Lấy chi tiết theo ngày

## Files đã tạo/sửa đổi

### 1. DTOs

- `src/modules/booking/dto/calendar-query.dto.ts` - Query parameters
- `src/modules/booking/dto/calendar-response.dto.ts` - Response structure

### 2. Service Methods

- `src/modules/booking/booking.service.ts` - Thêm 2 methods:
  - `getCalendarData()` - Lấy dữ liệu calendar
  - `getDayBookings()` - Lấy chi tiết theo ngày

### 3. Controller Endpoints

- `src/modules/booking/booking.controller.ts` - Thêm 2 endpoints:
  - `GET /bookings/calendar`
  - `GET /bookings/calendar/day/:date`

### 4. Documentation & Testing

- `test/calendar-management.test.http` - Test cases

## API Usage Examples

### 1. Admin quản lý nhiều homestay

```http
GET /bookings/calendar?viewType=monthly&startDate=2024-02-01&endDate=2024-02-29
Authorization: Bearer {{adminToken}}
```

### 2. Staff quản lý property được assign

```http
GET /bookings/calendar?viewType=weekly&propertyId={{propertyId}}
Authorization: Bearer {{staffToken}}
```

### 3. Xem chi tiết một ngày

```http
GET /bookings/calendar/day/2024-02-15?propertyId={{propertyId}}
Authorization: Bearer {{adminToken}}
```

## Response Structure

### Calendar Data

```json
{
  "startDate": "2024-02-01",
  "endDate": "2024-02-29",
  "viewType": "monthly",
  "days": [
    {
      "date": "2024-02-01",
      "dayOfWeek": "Thứ Năm",
      "isToday": false,
      "isWeekend": false,
      "bookings": [...],
      "totalBookings": 1,
      "totalRevenue": 2000000
    }
  ],
  "totalBookings": 15,
  "totalRevenue": 25000000,
  "averageOccupancy": 0.5
}
```

### Day Detail

```json
{
  "date": "2024-02-15",
  "dayOfWeek": "Thứ Năm",
  "isToday": true,
  "isWeekend": false,
  "bookings": [...],
  "totalBookings": 3,
  "totalRevenue": 4500000
}
```

## Use Cases

### 1. Admin Dashboard

- **Monthly view** để có cái nhìn tổng quan
- **Property filter** để tập trung vào từng homestay
- **Statistics** để theo dõi doanh thu và occupancy

### 2. Staff Management

- **Weekly view** để quản lý chi tiết
- **Auto-filter** theo assigned properties
- **Daily detail** để xem chi tiết booking

### 3. Listing Management

- **Listing filter** để xem availability
- **Daily view** để quản lý từng ngày

## Security & Performance

### Security

- ✅ Permission-based access (`booking.view`)
- ✅ Staff filtering (chỉ thấy assigned properties)
- ✅ Admin access (thấy tất cả)

### Performance

- ✅ Optimized queries với populate
- ✅ Date range filtering
- ✅ Index-friendly queries

## Testing

### Test Cases Covered

1. ✅ Admin calendar access
2. ✅ Staff calendar access (filtered)
3. ✅ Property filtering
4. ✅ Listing filtering
5. ✅ Date range filtering
6. ✅ View types (monthly/weekly/daily)
7. ✅ Day detail view

### Test File

- `test/calendar-management.test.http` - 8 test cases

## Next Steps

### Frontend Integration

1. **Calendar Component** - Hiển thị lịch trực quan
2. **Day Component** - Hiển thị từng ngày với bookings
3. **Booking Tooltip** - Hiển thị thông tin booking khi hover
4. **Filter UI** - Giao diện filter options

### Advanced Features

1. **Real-time Updates** - WebSocket integration
2. **Calendar Actions** - Click to create/edit booking
3. **Export Features** - Excel/PDF export
4. **Mobile Optimization** - Touch-friendly interface

## Conclusion

✅ **Calendar Management feature đã được implement thành công** với đầy đủ:

- API endpoints cho calendar data
- Role-based access control
- Flexible filtering options
- Comprehensive documentation
- Test cases

🎯 **Ready for frontend integration** và có thể deploy ngay.

---

## Tính năng chính

## Tính năng chính

### 1. Calendar Views

- **Monthly View**: Hiển thị theo tháng (mặc định)
- **Weekly View**: Hiển thị theo tuần
- **Daily View**: Hiển thị theo ngày

### 2. Filter Options

- **Property Filter**: Lọc theo property cụ thể
- **Listing Filter**: Lọc theo listing cụ thể
- **Status Filter**: Lọc theo trạng thái booking
- **Payment Status Filter**: Lọc theo trạng thái thanh toán

### 3. Staff Filtering

- **Admin**: Xem tất cả bookings của tất cả properties
- **Staff**: Chỉ xem bookings của properties được assign

## API Endpoints

### 1. Lấy dữ liệu calendar

```http
GET /bookings/calendar
```

**Query Parameters:**

- `startDate` (optional): Ngày bắt đầu (YYYY-MM-DD)
- `endDate` (optional): Ngày kết thúc (YYYY-MM-DD)
- `propertyId` (optional): ID của property
- `listingId` (optional): ID của listing
- `viewType` (optional): Loại view (monthly/weekly/daily)
- `status` (optional): Trạng thái booking
- `payment_status` (optional): Trạng thái thanh toán

**Response:**

```json
{
  "startDate": "2024-02-01",
  "endDate": "2024-02-29",
  "viewType": "monthly",
  "days": [
    {
      "date": "2024-02-01",
      "dayOfWeek": "Thứ Năm",
      "isToday": false,
      "isWeekend": false,
      "bookings": [
        {
          "_id": "booking_id",
          "guest_name": "Nguyễn Văn A",
          "guest_email": "guest@example.com",
          "checkInDate": "2024-02-01T00:00:00.000Z",
          "checkOutDate": "2024-02-03T00:00:00.000Z",
          "guests": 2,
          "status": "confirmed",
          "payment_status": "paid",
          "final_amount": 2000000,
          "listing_title": "Phòng Deluxe",
          "property_name": "Homestay ABC",
          "note": "Ghi chú booking",
          "additionalCost": 50000
        }
      ],
      "totalBookings": 1,
      "totalRevenue": 2000000
    }
  ],
  "totalBookings": 15,
  "totalRevenue": 25000000,
  "averageOccupancy": 0.5
}
```

### 2. Lấy thông tin booking chi tiết cho một ngày

```http
GET /bookings/calendar/day/{date}
```

**Path Parameters:**

- `date`: Ngày cần xem (YYYY-MM-DD)

**Query Parameters:**

- `propertyId` (optional): ID của property
- `listingId` (optional): ID của listing

**Response:**

```json
{
  "date": "2024-02-15",
  "dayOfWeek": "Thứ Năm",
  "isToday": true,
  "isWeekend": false,
  "bookings": [...],
  "totalBookings": 3,
  "totalRevenue": 4500000
}
```

## Use Cases

### 1. Admin quản lý nhiều homestay

- **View**: Monthly view để có cái nhìn tổng quan
- **Filter**: Có thể filter theo property để tập trung vào từng homestay
- **Statistics**: Xem tổng doanh thu và occupancy rate

### 2. Staff quản lý property được assign

- **View**: Weekly view để quản lý chi tiết
- **Auto-filter**: Tự động chỉ hiển thị bookings của property được assign
- **Daily detail**: Click vào ngày để xem chi tiết booking

### 3. Quản lý theo listing

- **Filter**: Chọn listing cụ thể để xem availability
- **Daily view**: Xem chi tiết từng ngày của listing

## Implementation Details

### Service Methods

#### `getCalendarData(queryDto, user)`

- Xác định khoảng thời gian dựa trên viewType
- Tạo filter cho booking query
- Áp dụng staff filter nếu cần
- Tạo calendar days với thông tin booking
- Tính toán statistics

#### `getDayBookings(date, propertyId?, listingId?, user?)`

- Lấy thông tin booking cho một ngày cụ thể
- Hỗ trợ filter theo property hoặc listing
- Áp dụng staff filter

### Security

- **Permission**: `booking.view` required
- **Staff Filter**: Staff chỉ thấy bookings của properties được assign
- **Admin Access**: Admin thấy tất cả bookings

### Performance

- **Pagination**: Không áp dụng pagination cho calendar data
- **Populate**: Chỉ populate các field cần thiết (title, name)
- **Index**: Sử dụng index trên checkInDate và check_out_date

## Frontend Integration

### Calendar Component

```typescript
interface CalendarProps {
  viewType: 'monthly' | 'weekly' | 'daily';
  startDate?: string;
  endDate?: string;
  propertyId?: string;
  listingId?: string;
  onDayClick?: (date: string) => void;
}
```

### Day Component

```typescript
interface DayProps {
  date: string;
  bookings: CalendarBookingDto[];
  isToday: boolean;
  isWeekend: boolean;
  onClick?: () => void;
}
```

### Booking Tooltip

```typescript
interface BookingTooltipProps {
  booking: CalendarBookingDto;
}
```

## Testing

### Test Cases

1. **Admin Calendar**: Xem tất cả bookings
2. **Staff Calendar**: Chỉ xem bookings của assigned properties
3. **Property Filter**: Filter theo property cụ thể
4. **Listing Filter**: Filter theo listing cụ thể
5. **Date Range**: Test với các khoảng thời gian khác nhau
6. **View Types**: Test monthly, weekly, daily views
7. **Day Detail**: Click vào ngày để xem chi tiết

### Test File

- `test/calendar-management.test.http`

## Future Enhancements

### 1. Real-time Updates

- WebSocket để cập nhật calendar real-time
- Notifications khi có booking mới

### 2. Advanced Filters

- Filter theo guest name
- Filter theo price range
- Filter theo booking source

### 3. Calendar Actions

- Click để tạo booking mới
- Drag & drop để move booking
- Quick edit booking từ calendar

### 4. Export Features

- Export calendar data to Excel
- Print calendar view
- Share calendar link

### 5. Mobile Optimization

- Touch-friendly calendar interface
- Swipe gestures cho navigation
- Responsive design cho mobile
