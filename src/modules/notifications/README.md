# Notifications Module

Module quản lý thông báo real-time cho hệ thống VinaSide, được thiết kế dựa trên pattern của Messages Module.

## 📋 Tổng quan

Module Notifications cung cấp đầy đủ tính năng quản lý thông báo bao gồm:

- ✅ Gửi thông báo real-time qua WebSocket
- ✅ Quản lý thông báo với pagination và filters
- ✅ Đánh dấu đã đọc/chưa đọc
- ✅ Soft delete (xóa mềm)
- ✅ API cho admin quản lý
- ✅ Internal service để gửi thông báo từ hệ thống

## 🗃️ Database Schema

```typescript
{
  _id: ObjectId,                    // Primary key
  user_id: ObjectId,               // Người nhận (ref users)
  recipient_type: String,          // "guest" | "host" | "admin"
  title: String,                   // Tiêu đề thông báo
  message: String,                 // Nội dung thông báo
  type: String,                    // "booking" | "payment" | "verification" | "refund" | "message" | "system" | "reminder"
  notification_template_id: ObjectId, // Liên kết với mẫu thông báo (optional)
  sent_method: [String],           // ["email", "in_app", "sms", "push"]
  status: String,                  // "pending" | "sent" | "failed"
  is_read: Boolean,                // Đã đọc hay chưa
  sent_at: DateTime,               // Thời điểm gửi thực tế
  isDeleted: Boolean,              // Thông báo đã bị xóa mềm chưa
  created_at: DateTime,            // Ngày tạo
  updated_at: DateTime             // Ngày cập nhật
}
```

## 🚀 API Endpoints

### 👤 User Endpoints

| Method   | Endpoint                      | Description                             | Auth |
| -------- | ----------------------------- | --------------------------------------- | ---- |
| `GET`    | `/notifications`              | Lấy danh sách thông báo (có pagination) | User |
| `GET`    | `/notifications/unread-count` | Lấy số thông báo chưa đọc               | User |
| `GET`    | `/notifications/:id`          | Lấy chi tiết thông báo                  | User |
| `PATCH`  | `/notifications/:id/read`     | Đánh dấu thông báo đã đọc               | User |
| `PATCH`  | `/notifications/read-all`     | Đánh dấu tất cả đã đọc                  | User |
| `PATCH`  | `/notifications/:id`          | Cập nhật thông báo                      | User |
| `DELETE` | `/notifications/:id`          | Xóa mềm thông báo                       | User |
| `DELETE` | `/notifications/clear`        | Xóa mềm tất cả thông báo                | User |

### 🔐 Admin Endpoints

| Method | Endpoint                   | Description            | Auth  |
| ------ | -------------------------- | ---------------------- | ----- |
| `GET`  | `/notifications/admin/all` | Xem toàn bộ thông báo  | Admin |
| `GET`  | `/notifications/admin/:id` | Xem chi tiết thông báo | Admin |

### ⚙️ Internal Service Endpoints

| Method | Endpoint                            | Description             | Auth           |
| ------ | ----------------------------------- | ----------------------- | -------------- |
| `POST` | `/notifications/internal/send`      | Gửi thông báo đơn lẻ    | Admin/Internal |
| `POST` | `/notifications/internal/bulk-send` | Gửi thông báo hàng loạt | Admin/Internal |

## 📝 Query Parameters

### Pagination & Filters

```
GET /notifications?page=1&limit=10&is_read=false&type=booking&status=sent&sort=-created_at
```

- `page`: Trang hiện tại (default: 1)
- `limit`: Số item per page (default: 10, max: 50)
- `is_read`: Filter theo trạng thái đọc (`true`/`false`)
- `type`: Filter theo loại thông báo
- `status`: Filter theo trạng thái gửi
- `sort`: Sắp xếp (ví dụ: `-created_at,type`)

## 🔌 Real-time WebSocket

### Connection

```javascript
const socket = io('http://localhost:3000/ws/notifications', {
  auth: { userId: 'user_id_here' },
});
```

### Events

#### Client → Server

- `join_notifications`: Join vào room notifications
- `mark_notification_read`: Đánh dấu đã đọc qua socket

#### Server → Client

- `new_notification`: Thông báo mới
- `notification_updated`: Thông báo được cập nhật
- `notification_read`: Thông báo được đánh dấu đã đọc
- `unread_count_updated`: Số thông báo chưa đọc thay đổi

## 💻 Usage Examples

### 1. Gửi thông báo booking mới

```javascript
POST /notifications/internal/send
{
  "user_id": "64e7b5a2c9d4e8f3a1b2c3d4",
  "recipient_type": "guest",
  "title": "Booking Confirmed",
  "message": "Your booking has been confirmed!",
  "type": "booking",
  "sent_method": ["email", "in_app"]
}
```

### 2. Lấy thông báo chưa đọc

```javascript
GET /notifications?is_read=false&page=1&limit=20
```

### 3. Đánh dấu tất cả đã đọc

```javascript
PATCH / notifications / read - all;
```

### 4. Real-time listening

```javascript
socket.on('new_notification', (notification) => {
  console.log('New notification:', notification);
  // Update UI
});

socket.on('unread_count_updated', (data) => {
  console.log('Unread count:', data.unreadCount);
  // Update badge
});
```

## 🧪 Testing

Sử dụng file `test-notifications.http` để test tất cả endpoints:

```bash
# Thay đổi variables trong file test
@authToken = YOUR_JWT_TOKEN_HERE
@userId = YOUR_USER_ID_HERE
```

## 🏗️ Architecture

```
notifications/
├── dto/                     # Data Transfer Objects
│   ├── create-notification.dto.ts
│   ├── update-notification.dto.ts
│   ├── query-notification.dto.ts
│   └── notification-response.dto.ts
├── interfaces/              # TypeScript interfaces
│   └── notification.interface.ts
├── schemas/                 # MongoDB schemas
│   └── notification.schema.ts
├── utils/                   # Utility functions
│   └── notification.util.ts
├── notifications.controller.ts  # REST API endpoints
├── notifications.service.ts     # Business logic
├── notifications.gateway.ts     # WebSocket gateway
├── notifications.module.ts      # NestJS module
└── README.md                    # Documentation
```

## 🔗 Integration với các module khác

### Từ Booking Module

```javascript
// Khi có booking mới
await this.notificationsService.createAndSend({
  user_id: booking.host_id,
  recipient_type: 'host',
  title: 'New Booking Request',
  message: `You have a new booking request from ${guest.name}`,
  type: 'booking',
  sent_method: ['email', 'in_app', 'push'],
});
```

### Từ Payment Module

```javascript
// Khi payment thành công
await this.notificationsService.createAndSend({
  user_id: booking.guest_id,
  recipient_type: 'guest',
  title: 'Payment Confirmed',
  message: 'Your payment has been processed successfully',
  type: 'payment',
  sent_method: ['email', 'in_app'],
});
```

### Từ Messages Module

```javascript
// Khi có tin nhắn mới
await this.notificationsService.createAndSend({
  user_id: message.receiver_id,
  recipient_type: receiverRole,
  title: 'New Message',
  message: `You have a new message from ${sender.name}`,
  type: 'message',
  sent_method: ['in_app', 'push'],
});
```

## 🔐 Security

- ✅ Authentication required cho tất cả endpoints
- ✅ Authorization based trên user roles
- ✅ User chỉ có thể xem/sửa notifications của mình
- ✅ Admin có thể xem tất cả notifications
- ✅ Input validation và sanitization
- ✅ Rate limiting cho internal endpoints

## 🚀 Performance Optimizations

- ✅ Database indexes cho queries thường dùng
- ✅ Pagination để tránh load quá nhiều data
- ✅ Aggregation pipeline để tính unread count efficiently
- ✅ WebSocket rooms để broadcast selective
- ✅ Soft delete thay vì hard delete

## 🎯 Future Enhancements

- [ ] Email templates system
- [ ] Push notification integration (FCM)
- [ ] SMS notifications
- [ ] Notification scheduling
- [ ] Read receipts tracking
- [ ] Notification categories/preferences
- [ ] Analytics dashboard
