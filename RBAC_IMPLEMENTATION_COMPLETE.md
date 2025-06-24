# 🔐 Triển khai hoàn chỉnh hệ thống RBAC Hybrid - Vinaside

## 🎉 Tổng quan triển khai

Hệ thống phân quyền Hybrid RBAC đã được triển khai đầy đủ với các tính năng:

- ✅ 3 system roles: `guest`, `staff`, `admin`
- ✅ Custom roles linh hoạt với permissions chi tiết
- ✅ Admin bypass toàn bộ kiểm tra
- ✅ Permission-based decorators cho controllers
- ✅ Validation DTOs và error handling
- ✅ Comprehensive API endpoints
- ✅ Seed data với 6 custom roles và 17 permissions

## 📁 Cấu trúc Files đã tạo/cập nhật

### 🗃️ Database Schemas

```
src/modules/auth/schemas/
├── custom-role.schema.ts           # CustomRole entity
├── permission.schema.ts            # Permission entity
├── custom-role-permission.schema.ts # N-N Role-Permission
└── user-custom-role.schema.ts      # N-N User-Role
```

### 🔧 Core Components

```
src/decorators/
└── require-permission.decorator.ts # @RequirePermission decorator

src/common/guards/
└── permission.guard.ts            # PermissionGuard với admin bypass

src/interfaces/
└── user-with-permissions.interface.ts # UserWithPermissions interface
```

### 🎮 Services & Controllers

```
src/modules/auth/
├── services/rbac.service.ts        # Core RBAC logic
├── controllers/rbac.controller.ts  # API endpoints
└── dto/                           # Validation DTOs
    ├── create-role.dto.ts
    ├── create-permission.dto.ts
    └── assign-role.dto.ts
```

### 🌱 Seed Data

```
src/database/
├── seeds/rbac.seed.ts             # Seed roles & permissions
└── seed.command.ts                # Seed runner script
```

## 🚀 Cách sử dụng

### 1. Khởi tạo dữ liệu

```bash
npm run seed:rbac
```

### 2. Sử dụng trong Controller

```typescript
import { RequirePermission } from 'src/decorators/require-permission.decorator';
import { PermissionGuard } from 'src/common/guards/permission.guard';

@Controller('listings')
export class ListingController {
  // ✅ Admin luôn được phép, staff cần permission 'listing.verify'
  @Patch(':id/verify')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('listing.verify')
  async verifyListing(@Param('id') id: string) {
    // Logic duyệt phòng
  }
}
```

### 3. Quản lý quyền qua API

#### Gán role cho user:

```bash
POST /rbac/users/{userId}/roles
{
  "roleKey": "reviewer"
}
```

#### Kiểm tra permissions của user:

```bash
GET /rbac/users/{userId}/permissions
```

#### Tạo role mới:

```bash
POST /rbac/roles
{
  "key": "new_role",
  "name": "Role mới",
  "description": "Mô tả role"
}
```

## 🎯 API Endpoints đầy đủ

| Method | Endpoint                                          | Permission  | Mô tả                    |
| ------ | ------------------------------------------------- | ----------- | ------------------------ |
| GET    | `/rbac/roles`                                     | `user.view` | Danh sách custom roles   |
| GET    | `/rbac/permissions`                               | `user.view` | Danh sách permissions    |
| GET    | `/rbac/users/:id/roles`                           | `user.view` | Roles của user           |
| GET    | `/rbac/users/:id/permissions`                     | `user.view` | Permissions của user     |
| POST   | `/rbac/users/:id/roles`                           | `user.edit` | Gán role cho user        |
| POST   | `/rbac/users/:id/roles/bulk`                      | `user.edit` | Gán nhiều roles          |
| DELETE | `/rbac/users/:id/roles/:roleKey`                  | `user.edit` | Xóa role khỏi user       |
| POST   | `/rbac/roles`                                     | `user.edit` | Tạo role mới             |
| POST   | `/rbac/permissions`                               | `user.edit` | Tạo permission mới       |
| POST   | `/rbac/roles/:roleKey/permissions`                | `user.edit` | Gán permission cho role  |
| DELETE | `/rbac/roles/:roleKey/permissions/:permissionKey` | `user.edit` | Xóa permission khỏi role |
| GET    | `/rbac/roles/:roleKey/users`                      | `user.view` | Users có role cụ thể     |
| GET    | `/rbac/users/:id/permissions/:key/check`          | `user.view` | Kiểm tra permission      |

## 📊 Custom Roles & Permissions

### 6 Custom Roles được seed:

1. **support_staff** - Nhân viên CSKH

   - `ticket.reply`, `ticket.view`, `ticket.close`, `user.view`, `notification.send`

2. **reviewer** - Kiểm duyệt viên

   - `listing.verify`, `listing.view`, `listing.edit`, `user.view`

3. **accounting** - Kế toán viên

   - `payment.refund`, `payment.view`, `booking.view`, `user.view`, `analytics.view`

4. **content_manager** - Quản lý nội dung

   - `listing.verify`, `listing.create`, `listing.edit`, `listing.delete`, `listing.view`, `user.view`, `user.edit`, `analytics.view`

5. **moderator** - Điều hành viên

   - `user.view`, `user.edit`, `user.ban`, `ticket.reply`, `ticket.view`, `ticket.close`, `booking.view`, `booking.cancel`, `listing.view`, `notification.send`

6. **analyst** - Chuyên viên phân tích
   - `analytics.view`, `user.view`, `booking.view`, `listing.view`, `payment.view`

### 17 Permissions chi tiết:

**Listing**: `verify`, `view`, `create`, `edit`, `delete`  
**Ticket**: `reply`, `view`, `close`  
**Payment**: `refund`, `view`  
**User**: `view`, `edit`, `ban`  
**Booking**: `view`, `cancel`  
**Analytics**: `view`  
**Notification**: `send`

## 🔄 Migration từ hệ thống cũ

```typescript
// ❌ Cũ: Dùng @Roles
@Patch(':id/verify')
@Roles('admin', 'staff')
async verifyListing() {
  // Tất cả staff đều có thể duyệt
}

// ✅ Mới: Dùng @RequirePermission
@Patch(':id/verify')
@RequirePermission('listing.verify')
async verifyListing() {
  // Chỉ staff có role 'reviewer' hoặc admin mới duyệt được
}
```

## 🛡️ Bảo mật và Performance

### Bảo mật:

- ✅ Admin bypass toàn bộ permission check
- ✅ Staff mặc định không có quyền nghiệp vụ
- ✅ Permissions được check ở guard level
- ✅ Type-safe với TypeScript
- ✅ Validation DTOs cho tất cả inputs

### Performance:

- ✅ Permissions được load 1 lần khi login (JWT)
- ✅ Cached trong memory cho mỗi request
- ✅ Database indexes trên compound keys
- ✅ Efficient MongoDB queries với populate

## 🧪 Testing

### Test permission check:

```bash
GET /rbac/users/USER_ID/permissions/listing.verify/check
```

### Test role assignment:

```bash
POST /rbac/users/USER_ID/roles
{
  "roleKey": "reviewer"
}
```

## 🔧 Maintenance

### Thêm permission mới:

```typescript
await rbacService.createPermission(
  'booking.approve',
  'booking',
  'approve',
  'Duyệt yêu cầu đặt phòng',
);
```

### Thêm role mới:

```typescript
await rbacService.createCustomRole(
  'booking_manager',
  'Quản lý booking',
  'Quản lý toàn bộ đặt phòng',
);

await rbacService.assignPermissionToRole('booking_manager', 'booking.approve');
```

## 📈 Monitoring & Debugging

### Kiểm tra permissions của user:

```typescript
const permissions = await rbacService.getUserPermissions(userId);
console.log('User permissions:', permissions);
```

### Debug permission check:

```typescript
const hasPermission = await rbacService.userHasPermission(
  userId,
  'listing.verify',
);
console.log(`User ${userId} has listing.verify:`, hasPermission);
```

## 🎯 Best Practices

1. **Luôn dùng @RequirePermission** thay vì @Roles cho business logic
2. **Admin bypass** - không cần check permission cho admin
3. **Granular permissions** - chia nhỏ quyền theo module.action
4. **Consistent naming** - `module.action` format
5. **Error handling** - wrap API calls trong try-catch
6. **Validation** - sử dụng DTOs cho tất cả inputs

---

🎉 **Hệ thống RBAC Hybrid đã được triển khai hoàn chỉnh!**

Admin có thể quản lý quyền linh hoạt mà không cần dev can thiệp. System roles đơn giản nhưng business permissions chi tiết và mạnh mẽ.
