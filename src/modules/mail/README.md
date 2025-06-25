# Hệ thống Email Notification - Staff Based

## Tổng quan

Hệ thống email đã được cập nhật từ host-based sang staff-based. Thay vì gửi email cho một host duy nhất, hệ thống giờ đây gửi email thông báo cho tất cả nhân viên (staff) được gán cho property đó.

## Những thay đổi chính

### 1. Interface ReservationData

```typescript
export interface ReservationData {
  id: string;
  userName: string;
  staffEmails?: string[]; // Thay đổi từ hostName thành staffEmails
  propertyName?: string;
  checkIn: Date | string;
  checkOut: Date | string;
  roomInfo: {
    name: string;
    address?: string;
    image?: string;
  };
  totalPrice: number;
}
```

### 2. Staff Notification Service

```typescript
// Thay đổi từ
async sendHostReservationNotification(hostEmail: string, reservationData: ReservationData)

// Thành
async sendStaffReservationNotification(staffEmails: string[], reservationData: ReservationData)
```

### 3. Queue Job Interface

```typescript
// Thay đổi từ
export interface HostNotificationJob {
  hostEmail: string;
  reservationData: ReservationData;
}

// Thành
export interface StaffNotificationJob {
  staffEmails: string[];
  reservationData: ReservationData;
}
```

## Cách sử dụng

### 1. Lấy Staff Emails từ Property

```typescript
// Cách 1: Sử dụng MailService
const staffEmails = await this.mailService.getStaffEmailsFromProperty(propertyId);

// Cách 2: Sử dụng API endpoint
GET /mail/staff-emails/property/:propertyId
```

### 2. Gửi Notification cho Staff

```typescript
// Cách 1: Gửi trực tiếp
await this.mailService.sendStaffReservationNotification(
  staffEmails,
  reservationData,
);

// Cách 2: Sử dụng Queue (Khuyến nghị)
await this.emailQueueService.addStaffNotification({
  staffEmails,
  reservationData,
});

// Cách 3: Gửi bằng propertyId (Thuận tiện nhất)
await this.mailService.sendStaffNotificationByProperty(
  propertyId,
  reservationData,
);
```

### 3. Ví dụ hoàn chỉnh trong Booking Service

```typescript
// Sau khi tạo booking thành công
const createdBooking = await this.bookingRepo.create(bookingData, user._id);

// Tạo reservation data
const reservationData: ReservationData = {
  id: createdBooking._id.toString(),
  userName: user.name || user.email,
  propertyName: property.name,
  checkIn: checkIn,
  checkOut: checkOut,
  roomInfo: {
    name: listing.title,
    address: property.location.address,
  },
  totalPrice: finalAmount,
};

// Gửi email cho khách hàng
await this.emailQueueService.addReservationConfirmation({
  email: user.email,
  reservationData,
});

// Gửi email cho staff
const staffEmails = await this.mailService.getStaffEmailsFromProperty(
  propertyId.toString(),
);
if (staffEmails.length > 0) {
  await this.emailQueueService.addStaffNotification({
    staffEmails,
    reservationData: { ...reservationData, staffEmails },
  });
}
```

## Template Email

### Template cho Staff: `staff-reservation-notification.hbs`

Template mới này được thiết kế đặc biệt cho nhân viên với:

- Thông báo rõ ràng về hành động cần thực hiện
- Danh sách check-list cho staff
- Giao diện chuyên nghiệp hơn
- Link đến trang quản lý dành cho staff

### Các biến template:

- `{{staffEmail}}` - Email của nhân viên nhận thông báo
- `{{guestName}}` - Tên khách hàng
- `{{propertyName}}` - Tên tài sản
- `{{checkIn}}` - Ngày check-in
- `{{checkOut}}` - Ngày check-out
- `{{totalPrice}}` - Tổng giá trị
- `{{reservationId}}` - ID đặt phòng

## API Endpoints

### 1. Gửi Email Tùy chỉnh

```
POST /mail/send
Permission: mail.send
```

### 2. Lấy Staff Emails theo Property

```
GET /mail/staff-emails/property/:propertyId
Permission: property.view
Response: {
  propertyId: string,
  staffEmails: string[],
  count: number
}
```

## Migration từ Host-based

### Các bước migration:

1. **Database**: Đảm bảo tất cả properties có `staffIds` array
2. **Code**: Cập nhật tất cả nơi sử dụng `sendHostReservationNotification`
3. **Templates**: Tạo template mới cho staff
4. **Testing**: Test với property có nhiều staff

### Breaking Changes:

- `HostNotificationJob` → `StaffNotificationJob`
- `sendHostReservationNotification()` → `sendStaffReservationNotification()`
- Template `host-reservation-notification.hbs` → `staff-reservation-notification.hbs`

## Best Practices

1. **Error Handling**: Luôn wrap email sending trong try-catch để không ảnh hưởng business logic
2. **Logging**: Log số lượng staff nhận được email
3. **Fallback**: Kiểm tra nếu không có staff nào được gán
4. **Performance**: Sử dụng queue cho bulk emails
5. **Monitoring**: Monitor email delivery rates

## Troubleshooting

### Không có staff nào nhận được email:

- Kiểm tra property có `staffIds` không
- Kiểm tra staff users có `role: 'staff'` và `is_verified: true`
- Kiểm tra staff users không bị `isDeleted: true`

### Email template lỗi:

- Đảm bảo file template tồn tại trong `src/modules/mail/templates/`
- Kiểm tra các biến template được truyền đầy đủ
