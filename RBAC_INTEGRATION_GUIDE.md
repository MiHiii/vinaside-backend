# 🔐 Hướng dẫn Tích hợp Hệ thống RBAC

## 📋 Tổng quan

Hệ thống RBAC (Role-Based Access Control) mới đã được thiết kế lại hoàn toàn để phù hợp với cấu trúc dự án **Vinaside Backend**. Thay vì sử dụng `@Roles()` đơn giản, giờ đây chúng ta có hệ thống **permissions chi tiết** và **custom roles** linh hoạt.

## 🎯 Những thay đổi chính

### ❌ Cũ: Role-based

```typescript
@Roles('admin', 'staff')
@Get()
async findAll() {
  // Tất cả admin và staff đều có quyền
}
```

### ✅ Mới: Permission-based

```typescript
@RequirePermission('booking.view')
@Get()
async findAll() {
  // Chỉ user có permission 'booking.view' mới có quyền
}
```

## 📊 Hệ thống Permissions

### 🏢 **Property Management**

- `property.view` - Xem thông tin tài sản
- `property.create` - Tạo mới tài sản
- `property.edit` - Chỉnh sửa tài sản
- `property.delete` - Xóa/khôi phục tài sản
- `property.verify` - Duyệt tài sản công khai
- `property.manage_staff` - Quản lý nhân viên tài sản

### 🏠 **Listing Management**

- `listing.view` - Xem danh sách listing
- `listing.create` - Tạo listing mới
- `listing.edit` - Chỉnh sửa listing
- `listing.delete` - Xóa listing
- `listing.verify` - Duyệt listing
- `listing.manage_status` - Quản lý trạng thái listing

### 📋 **Booking Management**

- `booking.view` - Xem thông tin đặt phòng
- `booking.create` - Tạo booking (guest)
- `booking.edit` - Chỉnh sửa booking
- `booking.cancel` - Hủy booking
- `booking.confirm` - Xác nhận booking
- `booking.manage_payment` - Quản lý thanh toán

### 👥 **User Management**

- `user.view` - Xem thông tin người dùng
- `user.edit` - Chỉnh sửa thông tin user
- `user.delete` - Xóa/khóa tài khoản
- `user.manage_roles` - Quản lý vai trò user
- `user.view_private_info` - Xem thông tin nhạy cảm

### 📝 **Content Management**

- `review.view` - Xem đánh giá
- `review.moderate` - Kiểm duyệt đánh giá
- `review.delete` - Xóa đánh giá vi phạm
- `message.view` - Xem tin nhắn
- `message.moderate` - Kiểm duyệt tin nhắn
- `message.send_admin` - Gửi tin nhắn admin
- `amenity.manage` - Quản lý tiện ích
- `safety_feature.manage` - Quản lý tính năng an toàn
- `house_rule.manage` - Quản lý nội quy

### 📊 **Analytics & System**

- `analytics.view` - Xem báo cáo thống kê
- `analytics.export` - Xuất báo cáo
- `notification.send` - Gửi thông báo
- `notification.broadcast` - Gửi thông báo hàng loạt
- `upload.manage` - Quản lý upload file
- `system.manage` - Quản lý hệ thống

## 👔 Custom Roles

### 🏢 **property_manager** - Quản lý Tài sản

**Mô tả**: Quản lý toàn bộ tài sản và listing  
**Permissions**: 14 quyền bao gồm property và listing management, booking view, analytics

### 📋 **booking_manager** - Quản lý Đặt phòng

**Mô tả**: Chuyên viên xử lý booking và thanh toán  
**Permissions**: 10 quyền tập trung vào booking, payment và notification

### ✅ **content_moderator** - Kiểm duyệt Nội dung

**Mô tả**: Kiểm duyệt listing, review, tin nhắn  
**Permissions**: 10 quyền về verification và moderation

### 🎧 **customer_service** - Chăm sóc Khách hàng

**Mô tả**: Hỗ trợ khách hàng, xử lý khiếu nại  
**Permissions**: 10 quyền về user support và communication

### ⚙️ **operations_staff** - Nhân viên Vận hành

**Mô tả**: Vận hành hàng ngày, báo cáo  
**Permissions**: 7 quyền cơ bản về view và notification

### 📝 **content_manager** - Quản lý Nội dung

**Mô tả**: Quản lý nội dung trang web, tiện ích, nội quy  
**Permissions**: 7 quyền về content management

### 📈 **analyst** - Chuyên viên Phân tích

**Mô tả**: Phân tích dữ liệu, tạo báo cáo  
**Permissions**: 6 quyền về analytics và reporting

### 👨‍💼 **admin_assistant** - Trợ lý Quản trị

**Mô tả**: Hỗ trợ quản trị viên, quyền hạn mở rộng  
**Permissions**: 22 quyền - gần như toàn quyền trừ system management

## 🔧 Cách sử dụng trong Controllers

### 1. Import các dependencies cần thiết

```typescript
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { Roles } from 'src/decorators/roles.decorator'; // Cho guest endpoints
```

### 2. Setup Controller với Guards

```typescript
@ApiTags('Module Name')
@Controller('module')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ModuleController {
  // controller methods
}
```

### 3. Áp dụng Permissions cho từng endpoint

```typescript
// ✅ Permissions cho staff
@RequirePermission('module.view')
@Get()
async findAll() { }

@RequirePermission('module.edit')
@Patch(':id')
async update() { }

@RequirePermission('module.delete')
@Delete(':id')
async remove() { }

// ✅ Roles cho guest (giữ nguyên)
@Roles('guest')
@Post()
async create() { }

// ✅ Public endpoints
@Public()
@Get('public')
async findPublic() { }
```

## 🔄 Migration từ hệ thống cũ

### Booking Controller

```typescript
// ❌ Cũ
@Roles('admin')
@Get()
findAll() { }

@Roles('staff', 'admin')
@Patch(':id/confirm')
confirm() { }

// ✅ Mới
@RequirePermission('booking.view')
@Get()
findAll() { }

@RequirePermission('booking.confirm')
@Patch(':id/confirm')
confirm() { }
```

### Property Controller

```typescript
// ❌ Cũ
@Roles('staff', 'admin')
@Post()
create() { }

@Roles('admin')
@Patch(':id/verify')
verify() { }

// ✅ Mới
@RequirePermission('property.create')
@Post()
create() { }

@RequirePermission('property.verify')
@Patch(':id/verify')
verify() { }
```

## 🎯 Quản lý Roles qua API

### 1. Lấy danh sách roles và permissions

```bash
GET /api/v1/rbac/roles
GET /api/v1/rbac/permissions
```

### 2. Gán role cho user

```bash
POST /api/v1/rbac/users/{userId}/roles
{
  "roleKey": "booking_manager"
}
```

### 3. Gán nhiều roles cùng lúc

```bash
POST /api/v1/rbac/users/{userId}/roles/bulk
{
  "roleKeys": ["content_moderator", "customer_service"]
}
```

### 4. Xem permissions của user

```bash
GET /api/v1/rbac/users/{userId}/permissions
```

### 5. Kiểm tra permission cụ thể

```bash
GET /api/v1/rbac/users/{userId}/permissions/{permissionKey}/check
```

## 📋 Patterns thường dùng

### Mixed Authorization (Roles + Permissions)

```typescript
@Controller('bookings')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BookingController {
  // Guest tạo booking
  @Roles('guest')
  @Post()
  create() {}

  // Staff xem booking (cần permission)
  @RequirePermission('booking.view')
  @Get()
  findAll() {}

  // Public endpoint
  @Public()
  @Get('check-availability/:listingId')
  checkAvailability() {}
}
```

### Conditional Permissions

```typescript
// Trong service layer
async updateBooking(id: string, user: JwtPayload) {
  if (user.role === 'admin') {
    // Admin có thể làm mọi thứ
    return this.performUpdate(id);
  }

  if (user.permissions.includes('booking.edit')) {
    // Staff có permission mới có thể edit
    return this.performUpdate(id);
  }

  // Guest chỉ edit booking của mình
  if (user.role === 'guest') {
    return this.performGuestUpdate(id, user._id);
  }

  throw new ForbiddenException('Không có quyền');
}
```

## 🚀 Chạy seed để tạo data RBAC

```bash
npm run seed:rbac
```

Lệnh này sẽ tạo:

- 38 permissions
- 8 custom roles với assignments sẵn

## ⚠️ Lưu ý quan trọng

1. **Guest endpoints**: Vẫn dùng `@Roles('guest')` như cũ
2. **Public endpoints**: Dùng `@Public()` và không cần guards
3. **Staff endpoints**: Dùng `@RequirePermission('permission.key')`
4. **Admin**: Luôn bypass tất cả permission checks
5. **Guards**: Phải có cả `JwtAuthGuard` và `PermissionGuard`

## 🔍 Troubleshooting

### Permission bị deny

- Kiểm tra user có role với permission tương ứng chưa
- Xem trong database collections: `customroles`, `permissions`, `customrolepermissions`, `usercustomroles`

### Guard không hoạt động

- Đảm bảo controller có `@UseGuards(JwtAuthGuard, PermissionGuard)`
- Import đúng `PermissionGuard` từ `../../common/guards/permission.guard`

### JWT payload thiếu permissions

- Kiểm tra `JwtStrategy.validate()` có load permissions không
- Đảm bảo `JwtPayload` interface được sử dụng đúng

Hệ thống RBAC mới cung cấp khả năng phân quyền chi tiết và linh hoạt hơn nhiều so với hệ thống cũ, phù hợp với yêu cầu phát triển dài hạn của dự án! 🎉
