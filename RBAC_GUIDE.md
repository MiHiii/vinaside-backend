# 🔐 Hệ thống phân quyền Hybrid RBAC - Vinaside

## 📋 Tổng quan

Hệ thống phân quyền hybrid RBAC (Role-Based Access Control) của Vinaside kết hợp:

- **3 system roles cố định**: `guest`, `staff`, `admin`
- **Custom roles linh hoạt**: gán quyền nghiệp vụ thông qua permissions
- **Admin bypass**: Admin luôn có full quyền, bỏ qua kiểm tra permission

## 🏗️ Cấu trúc Database

### System Roles (trong `users.role`)

- `guest`: Người dùng thường, không có quyền đặc biệt
- `staff`: Nhân viên nội bộ, cần gán custom role để có quyền nghiệp vụ
- `admin`: Quản trị toàn hệ thống, bypass mọi kiểm tra

### Custom Roles & Permissions

```typescript
// CustomRole
{
  key: 'reviewer',
  name: 'Kiểm duyệt viên',
  description: 'Nhân viên kiểm duyệt bài đăng phòng'
}

// Permission
{
  key: 'listing.verify',
  module: 'listing',
  action: 'verify',
  description: 'Duyệt bài đăng phòng'
}
```

## 🚀 Cài đặt và Seed Data

### 1. Chạy seed data RBAC

```bash
npm run seed:rbac
```

### 2. Custom Roles có sẵn

- `support_staff`: Nhân viên CSKH
- `reviewer`: Kiểm duyệt viên
- `accounting`: Kế toán viên
- `content_manager`: Quản lý nội dung
- `moderator`: Điều hành viên

### 3. Permissions có sẵn

- `listing.verify`, `listing.create`, `listing.edit`, `listing.delete`
- `ticket.reply`, `ticket.view`, `ticket.close`
- `payment.refund`, `payment.view`
- `user.view`, `user.edit`, `user.ban`
- `booking.view`, `booking.cancel`

## 🔧 Sử dụng trong Code

### 1. Decorator kiểm tra quyền

```typescript
import { RequirePermission } from 'src/decorators/require-permission.decorator';
import { PermissionGuard } from 'src/common/guards/permission.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('listings')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ListingController {
  // Chỉ user có permission 'listing.verify' mới được duyệt
  @Patch(':id/verify')
  @RequirePermission('listing.verify')
  async verifyListing(@Param('id') id: string) {
    // Logic duyệt phòng
  }

  // Admin luôn được phép, staff cần permission 'listing.create'
  @Post()
  @RequirePermission('listing.create')
  async createListing(@Body() dto: CreateListingDto) {
    // Logic tạo phòng
  }
}
```

### 2. Quản lý roles cho user

```typescript
// Gán role cho user
await rbacService.assignRoleToUser(userId, 'reviewer');

// Xóa role khỏi user
await rbacService.removeRoleFromUser(userId, 'reviewer');

// Lấy permissions của user
const permissions = await rbacService.getUserPermissions(userId);
```

### 3. Frontend kiểm tra quyền

```typescript
// User object từ JWT sẽ có permissions array
const user = {
  _id: '...',
  email: '...',
  role: 'staff',
  permissions: ['listing.verify', 'user.view'],
};

// Kiểm tra quyền trong component
if (user.permissions.includes('listing.verify')) {
  // Hiển thị button duyệt phòng
}
```

## 🎯 API Endpoints

### Quản lý RBAC

```
GET    /rbac/roles                    # Danh sách custom roles
GET    /rbac/permissions              # Danh sách permissions
GET    /rbac/users/:id/roles          # Roles của user
GET    /rbac/users/:id/permissions    # Permissions của user
POST   /rbac/users/:id/roles/:roleKey # Gán role cho user
DELETE /rbac/users/:id/roles/:roleKey # Xóa role khỏi user
```

### Ví dụ response

```json
{
  "statusCode": 200,
  "data": {
    "permissions": ["listing.verify", "listing.edit", "user.view"]
  }
}
```

## ✅ Luồng hoạt động

1. **User login** → JWT Strategy load permissions vào token
2. **Request đến API** → PermissionGuard kiểm tra
3. **Admin** → Bypass, luôn được phép
4. **Staff** → Kiểm tra `user.permissions.includes(required)`
5. **Guest** → Chặn nếu cần permission

## 🔄 Migration từ hệ thống cũ

```typescript
// Cũ: role-based
@Roles('admin', 'staff')
async updateListing() {}

// Mới: permission-based
@RequirePermission('listing.edit')
async updateListing() {}
```

## 🛡️ Bảo mật

- **Admin bypass**: Đảm bảo admin luôn có quyền
- **Staff minimal**: Staff mặc định không có quyền nghiệp vụ
- **Permission granular**: Quyền được chia nhỏ theo module.action
- **Database indexes**: Tối ưu query với compound indexes

## 🎨 Ưu điểm

✅ **Code sạch**: Decorator rõ ràng, không lẫn lộn logic nghiệp vụ  
✅ **An toàn**: Không ai có quyền nhạy cảm mặc định  
✅ **Linh hoạt**: Thêm role/permission không cần sửa code  
✅ **Performant**: Cache permissions trong JWT, ít query DB  
✅ **Scalable**: Dễ mở rộng cho nhiều module mới

## 📚 Ví dụ thực tế

```typescript
// Tạo role mới cho "Quản lý booking"
await rbacService.createCustomRole(
  'booking_manager',
  'Quản lý đặt phòng',
  'Nhân viên quản lý toàn bộ đặt phòng'
);

// Tạo permission mới
await rbacService.createPermission(
  'booking.approve',
  'booking',
  'approve',
  'Duyệt yêu cầu đặt phòng'
);

// Gán permission cho role
await rbacService.assignPermissionToRole('booking_manager', 'booking.approve');

// Gán role cho user
await rbacService.assignRoleToUser(userId, 'booking_manager');

// Sử dụng trong controller
@RequirePermission('booking.approve')
async approveBooking(@Param('id') id: string) {
  // Logic duyệt booking
}
```

---

🎉 **Hệ thống RBAC đã sẵn sàng sử dụng!** Admin có thể dễ dàng quản lý quyền mà không cần dev can thiệp.
