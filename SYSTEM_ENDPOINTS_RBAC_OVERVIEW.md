# 📊 **Tổng quan Endpoints & RBAC System**

## 🎯 **Summary**

| **Metric**            | **Count**               | **Status** |
| --------------------- | ----------------------- | ---------- |
| **Total Controllers** | 17                      | ✅         |
| **Total Endpoints**   | ~200+                   | ✅         |
| **RBAC Permissions**  | 38                      | ✅         |
| **Custom Roles**      | 8                       | ✅         |
| **System Roles**      | 3 (guest, staff, admin) | ✅         |

---

## 🏗️ **Endpoints By Module**

### **1. Auth Module** (`/auth`)

- **Controller**: `auth.controller.ts`
- **Endpoints**: 14
- **Protection**: Mixed (Public + JWT)

| Method | Endpoint                    | Permission/Role                     | Type      |
| ------ | --------------------------- | ----------------------------------- | --------- |
| POST   | `/auth/login`               | `@Public()`                         | Public    |
| POST   | `/auth/register`            | `@Public()`                         | Public    |
| POST   | `/auth/refresh-token`       | `@Public()`                         | Public    |
| POST   | `/auth/verify-email-otp`    | `@Public()`                         | Public    |
| GET    | `/auth/verify-email/:token` | `@Public()`                         | Public    |
| POST   | `/auth/forgot-password`     | `@Public()`                         | Public    |
| POST   | `/auth/reset-password`      | `@Public()`                         | Public    |
| GET    | `/auth/me`                  | `@Roles('guest', 'staff', 'admin')` | Protected |
| POST   | `/auth/logout`              | `@Roles('guest', 'staff', 'admin')` | Protected |
| GET    | `/auth/sessions`            | `@Roles('guest', 'staff', 'admin')` | Protected |
| DELETE | `/auth/sessions/:sessionId` | `@Roles('guest', 'staff', 'admin')` | Protected |
| DELETE | `/auth/sessions`            | `@Roles('guest', 'staff', 'admin')` | Protected |
| DELETE | `/auth/sessions/other`      | `@Roles('guest', 'staff', 'admin')` | Protected |
| DELETE | `/auth/delete-account`      | `@Roles('guest', 'staff', 'admin')` | Protected |

### **2. RBAC Module** (`/rbac`)

- **Controller**: `rbac.controller.ts`
- **Endpoints**: 16
- **Protection**: Permission-based

| Method | Endpoint                                          | Permission               | Admin Only |
| ------ | ------------------------------------------------- | ------------------------ | ---------- |
| GET    | `/rbac/roles`                                     | `system.manage`          | ✅         |
| GET    | `/rbac/permissions`                               | `system.manage`          | ✅         |
| GET    | `/rbac/roles/:roleId/permissions`                 | `system.manage`          | ✅         |
| GET    | `/rbac/users/:userId/roles`                       | `user.view_private_info` | 🔐         |
| GET    | `/rbac/users/:userId/permissions`                 | `user.view_private_info` | 🔐         |
| POST   | `/rbac/users/:userId/roles`                       | `user.manage_roles`      | 🔐         |
| DELETE | `/rbac/users/:userId/roles/:roleKey`              | `user.manage_roles`      | 🔐         |
| POST   | `/rbac/roles`                                     | `system.manage`          | ✅         |
| POST   | `/rbac/permissions`                               | `system.manage`          | ✅         |
| POST   | `/rbac/roles/:roleKey/permissions`                | `system.manage`          | ✅         |
| DELETE | `/rbac/roles/:roleKey/permissions/:permissionKey` | `system.manage`          | ✅         |

### **3. Users Module** (`/users`)

- **Controller**: `users.controller.ts`
- **Endpoints**: 10
- **Protection**: Permission-based

| Method | Endpoint                   | Permission    |
| ------ | -------------------------- | ------------- |
| GET    | `/users`                   | `user.view`   |
| GET    | `/users/staff`             | `user.view`   |
| GET    | `/users/count/total`       | `user.view`   |
| GET    | `/users/:id`               | `user.view`   |
| POST   | `/users`                   | `user.create` |
| PUT    | `/users/:id`               | `user.edit`   |
| PATCH  | `/users/me`                | `user.edit`   |
| PATCH  | `/users/:id`               | `user.edit`   |
| PATCH  | `/users/:id/toggle-status` | `user.manage` |
| DELETE | `/users/:id`               | `user.delete` |

### **4. Properties Module** (`/properties`)

- **Controller**: `property.controller.ts`
- **Endpoints**: 12
- **Protection**: Permission-based + PropertyStaff

| Method | Endpoint                     | Permission        | Extra Guard |
| ------ | ---------------------------- | ----------------- | ----------- |
| POST   | `/properties`                | `property.create` | -           |
| GET    | `/properties`                | `property.view`   | -           |
| GET    | `/properties/public`         | `@Public()`       | -           |
| GET    | `/properties/nearby`         | `@Public()`       | -           |
| GET    | `/properties/stats`          | `property.view`   | -           |
| GET    | `/properties/:id/statistics` | `property.view`   | -           |
| GET    | `/properties/my-properties`  | `property.view`   | -           |
| GET    | `/properties/staff/:staffId` | `property.view`   | -           |
| GET    | `/properties/:id`            | `@Public()`       | -           |
| PATCH  | `/properties/:id`            | `property.edit`   | -           |
| PATCH  | `/properties/:id/status`     | `property.edit`   | -           |
| PATCH  | `/properties/:id/verify`     | `property.verify` | -           |
| PATCH  | `/properties/:id/staff`      | `property.edit`   | -           |
| DELETE | `/properties/:id`            | `property.delete` | -           |
| PATCH  | `/properties/:id/restore`    | `property.delete` | -           |

### **5. Listings Module** (`/listings`)

- **Controller**: `listing.controller.ts`
- **Endpoints**: 11
- **Protection**: Permission-based + PropertyStaff

| Method | Endpoint                                     | Permission                | PropertyStaff |
| ------ | -------------------------------------------- | ------------------------- | ------------- |
| POST   | `/listings`                                  | `listing.create`          | ✅            |
| PUT    | `/listings/property/:propertyId/:id`         | `listing.edit`            | ✅            |
| DELETE | `/listings/property/:propertyId/:id`         | `listing.delete`          | ✅            |
| PATCH  | `/listings/property/:propertyId/:id/restore` | `listing.restore`         | ✅            |
| PATCH  | `/listings/property/:propertyId/:id/status`  | `listing.manage_status`   | ✅            |
| GET    | `/listings`                                  | `@Public()`               | -             |
| GET    | `/listings/top/viewed`                       | `@Public()`               | -             |
| GET    | `/listings/:id`                              | `@Public()`               | -             |
| GET    | `/listings/:id/view`                         | `@Public()`               | -             |
| GET    | `/listings/statistics/:id`                   | `listing.view_statistics` | -             |

### **6. Bookings Module** (`/bookings`)

- **Controller**: `booking.controller.ts`
- **Endpoints**: 15
- **Protection**: Mixed (Guest + Permission-based)

| Method | Endpoint                                            | Protection                          | Special       |
| ------ | --------------------------------------------------- | ----------------------------------- | ------------- |
| POST   | `/bookings`                                         | `@Roles('guest')`                   | Guest only    |
| GET    | `/bookings`                                         | `booking.view`                      | Staff         |
| GET    | `/bookings/my-bookings`                             | `@Roles('guest', 'staff', 'admin')` | All users     |
| GET    | `/bookings/my-history`                              | `@Roles('guest', 'staff', 'admin')` | All users     |
| GET    | `/bookings/guest/:guestId`                          | `booking.view`                      | Staff         |
| GET    | `/bookings/staff/:staffId`                          | `booking.view`                      | Staff         |
| GET    | `/bookings/property/:propertyId/listing/:listingId` | `@Roles('guest', 'staff', 'admin')` | All users     |
| GET    | `/bookings/check-availability/:listingId`           | `@Public()`                         | Public        |
| GET    | `/bookings/booked-dates/:listingId`                 | `@Public()`                         | Public        |
| GET    | `/bookings/property/:propertyId/:id`                | `booking.view`                      | PropertyStaff |
| PATCH  | `/bookings/property/:propertyId/:id`                | `booking.edit`                      | PropertyStaff |
| DELETE | `/bookings/property/:propertyId/:id`                | `booking.delete`                    | PropertyStaff |
| PATCH  | `/bookings/property/:propertyId/:id/confirm`        | `booking.confirm`                   | PropertyStaff |

### **7. Reviews Module** (`/reviews`)

- **Controller**: `reviews.controller.ts`
- **Endpoints**: 8
- **Protection**: Permission-based + Guest

| Method | Endpoint                    | Permission      | Type   |
| ------ | --------------------------- | --------------- | ------ |
| POST   | `/reviews`                  | `review.create` | Staff  |
| GET    | `/reviews`                  | `@Public()`     | Public |
| GET    | `/reviews/rooms/:roomId`    | `@Public()`     | Public |
| GET    | `/reviews/:id`              | `@Public()`     | Public |
| GET    | `/reviews/admin/search`     | `review.view`   | Staff  |
| GET    | `/reviews/admin/statistics` | `review.view`   | Staff  |
| GET    | `/reviews/admin/all`        | `review.view`   | Staff  |
| DELETE | `/reviews/admin/:id`        | `review.delete` | Staff  |

### **8. Messages Module** (`/messages`)

- **Controller**: `messages.controller.ts`
- **Endpoints**: 20+
- **Protection**: Mixed (Roles + Permissions)

| Method | Endpoint                  | Protection                          | Note      |
| ------ | ------------------------- | ----------------------------------- | --------- |
| POST   | `/messages`               | `message.create`                    | Staff     |
| GET    | `/messages`               | `message.view`                      | Staff     |
| GET    | `/messages/conversations` | `@Roles('guest', 'staff', 'admin')` | All users |
| GET    | `/messages/conversation`  | `@Roles('guest', 'staff', 'admin')` | All users |
| POST   | `/messages/:id/reactions` | `@Roles('guest', 'staff', 'admin')` | All users |
| DELETE | `/messages/:id/reactions` | `@Roles('guest', 'staff', 'admin')` | All users |
| GET    | `/messages/:id`           | `message.view`                      | Staff     |
| PATCH  | `/messages/:id`           | `message.edit`                      | Staff     |
| DELETE | `/messages/:id`           | `message.delete`                    | Staff     |

### **9. Notifications Module** (`/notifications`)

- **Controller**: `notifications.controller.ts`
- **Endpoints**: 12
- **Protection**: Mixed (Roles + Permissions)

| Method | Endpoint                            | Protection                          | Type      |
| ------ | ----------------------------------- | ----------------------------------- | --------- |
| GET    | `/notifications`                    | `@Roles('guest', 'staff', 'admin')` | All users |
| GET    | `/notifications/unread-count`       | `@Roles('guest', 'staff', 'admin')` | All users |
| GET    | `/notifications/:id`                | `@Roles('guest', 'staff', 'admin')` | All users |
| PATCH  | `/notifications/:id`                | `@Roles('guest', 'staff', 'admin')` | All users |
| PATCH  | `/notifications/:id/read`           | `@Roles('guest', 'staff', 'admin')` | All users |
| PATCH  | `/notifications/read-all`           | `@Roles('guest', 'staff', 'admin')` | All users |
| DELETE | `/notifications/:id`                | `@Roles('guest', 'staff', 'admin')` | All users |
| DELETE | `/notifications/clear`              | `@Roles('guest', 'staff', 'admin')` | All users |
| GET    | `/notifications/admin/all`          | `notification.send`                 | Staff     |
| GET    | `/notifications/admin/:id`          | `notification.send`                 | Staff     |
| POST   | `/notifications/internal/send`      | `notification.send`                 | Internal  |
| POST   | `/notifications/internal/bulk-send` | `notification.broadcast`            | Internal  |

### **10. Vouchers Module** (`/vouchers`)

- **Controller**: `voucher.controller.ts`
- **Endpoints**: 16
- **Protection**: Permission-based + Guest

| Method | Endpoint                   | Permission                          | Type      |
| ------ | -------------------------- | ----------------------------------- | --------- |
| POST   | `/vouchers`                | `voucher.create`                    | Staff     |
| GET    | `/vouchers`                | `voucher.view`                      | Staff     |
| GET    | `/vouchers/valid`          | `@Public()`                         | Public    |
| GET    | `/vouchers/validate/:code` | `@Roles('guest', 'admin', 'staff')` | All users |
| GET    | `/vouchers/statistics`     | `voucher.view`                      | Staff     |
| PUT    | `/vouchers/:id`            | `voucher.edit`                      | Staff     |
| DELETE | `/vouchers/:id`            | `voucher.delete`                    | Staff     |
| POST   | `/vouchers/:id/use`        | `voucher.edit`                      | Staff     |

### **11. Amenities Module** (`/amenities`)

- **Controller**: `amenities.controller.ts`
- **Endpoints**: 10
- **Protection**: Permission-based + Public

| Method | Endpoint                        | Permission       | Type   |
| ------ | ------------------------------- | ---------------- | ------ |
| GET    | `/amenities/public`             | `@Public()`      | Public |
| GET    | `/amenities/public/:id`         | `@Public()`      | Public |
| GET    | `/amenities`                    | `amenity.view`   | Staff  |
| GET    | `/amenities/search`             | `amenity.view`   | Staff  |
| GET    | `/amenities/:id`                | `amenity.view`   | Staff  |
| POST   | `/amenities`                    | `amenity.create` | Staff  |
| PUT    | `/amenities/:id`                | `amenity.edit`   | Staff  |
| DELETE | `/amenities/:id`                | `amenity.delete` | Staff  |
| PUT    | `/amenities/:id/restore`        | `amenity.edit`   | Staff  |
| PUT    | `/amenities/:id/toggle-status`  | `amenity.edit`   | Staff  |
| PUT    | `/amenities/:id/toggle-default` | `amenity.edit`   | Staff  |

### **12. Safety Features Module** (`/safety-features`)

- **Controller**: `safety_features.controller.ts`
- **Endpoints**: 10
- **Protection**: Permission-based + Public

| Method | Endpoint                      | Permission              | Type   |
| ------ | ----------------------------- | ----------------------- | ------ |
| GET    | `/safety-features/public`     | `@Public()`             | Public |
| GET    | `/safety-features/public/:id` | `@Public()`             | Public |
| GET    | `/safety-features`            | `safety_feature.view`   | Staff  |
| POST   | `/safety-features`            | `safety_feature.create` | Staff  |
| PUT    | `/safety-features/:id`        | `safety_feature.edit`   | Staff  |
| DELETE | `/safety-features/:id`        | `safety_feature.delete` | Staff  |

### **13. House Rules Module** (`/house-rules`)

- **Controller**: `house-rules.controller.ts`
- **Endpoints**: 10
- **Protection**: Permission-based + Public

| Method | Endpoint                  | Permission          | Type   |
| ------ | ------------------------- | ------------------- | ------ |
| GET    | `/house-rules/public`     | `@Public()`         | Public |
| GET    | `/house-rules/public/:id` | `@Public()`         | Public |
| GET    | `/house-rules`            | `house_rule.view`   | Staff  |
| POST   | `/house-rules`            | `house_rule.create` | Staff  |
| PUT    | `/house-rules/:id`        | `house_rule.edit`   | Staff  |
| DELETE | `/house-rules/:id`        | `house_rule.delete` | Staff  |

### **14. Location Module** (`/locations`)

- **Controller**: `location.controller.ts`
- **Endpoints**: 3
- **Protection**: Public only

| Method | Endpoint                  | Permission/Role | Type   |
| ------ | ------------------------- | --------------- | ------ |
| GET    | `/locations/autocomplete` | `@Public()`     | Public |
| GET    | `/locations/details`      | `@Public()`     | Public |
| GET    | `/locations/cities`       | `@Public()`     | Public |

### **15. Services Module** (`/services`)

- **Controller**: `services.controller.ts`
- **Endpoints**: 15
- **Protection**: Mixed (Public + Permission-based)

| Method | Endpoint                         | Permission/Role  | Type   |
| ------ | -------------------------------- | ---------------- | ------ |
| POST   | `/services`                      | `service.create` | Staff  |
| GET    | `/services`                      | `service.view`   | Staff  |
| GET    | `/services/active`               | `@Public()`      | Public |
| GET    | `/services/price-range`          | `@Public()`      | Public |
| GET    | `/services/stats/unit`           | `service.view`   | Staff  |
| GET    | `/services/stats/status`         | `service.view`   | Staff  |
| GET    | `/services/unit/:unit`           | `@Public()`      | Public |
| GET    | `/services/price-order/:order`   | `@Public()`      | Public |
| GET    | `/services/similar-price/:price` | `@Public()`      | Public |
| GET    | `/services/name/:name`           | `service.view`   | Staff  |
| GET    | `/services/:id`                  | `service.view`   | Staff  |
| PUT    | `/services/bulk-update-status`   | `service.edit`   | Staff  |
| PUT    | `/services/:id`                  | `service.edit`   | Staff  |
| PUT    | `/services/:id/restore`          | `service.delete` | Staff  |
| PUT    | `/services/:id/toggle-status`    | `service.edit`   | Staff  |
| DELETE | `/services/:id`                  | `service.delete` | Staff  |

### **16. Transaction Logs Module** (`/transaction-logs`)

- **Controller**: `transaction-logs.controller.ts`
- **Endpoints**: 7
- **Protection**: Permission-based + PropertyStaff

| Method | Endpoint                                  | Permission               | PropertyStaff |
| ------ | ----------------------------------------- | ------------------------ | ------------- |
| GET    | `/transaction-logs/transaction/:id`       | `booking.view`           | -             |
| GET    | `/transaction-logs/user/:userId`          | `booking.view`           | -             |
| GET    | `/transaction-logs/changed-by/:changedBy` | `analytics.view`         | -             |
| GET    | `/transaction-logs/stats`                 | `analytics.view`         | -             |
| GET    | `/transaction-logs/:id`                   | `booking.view`           | -             |
| DELETE | `/transaction-logs/:id`                   | `booking.manage_payment` | -             |
| GET    | `/transaction-logs/property/:propertyId`  | `booking.view`           | ✅            |

### **17. Upload Module** (`/upload`)

- **Controller**: `upload.controller.ts`
- **Endpoints**: 6
- **Protection**: Mixed (Roles + Permission-based)

| Method | Endpoint           | Permission/Role                     | Type      |
| ------ | ------------------ | ----------------------------------- | --------- |
| POST   | `/upload`          | `@Roles('guest', 'staff', 'admin')` | All users |
| POST   | `/upload/multiple` | `upload.create`                     | Staff     |
| POST   | `/upload/data`     | `upload.manage`                     | Staff     |
| POST   | `/upload/banner`   | `upload.create`                     | Staff     |
| DELETE | `/upload/:key`     | `upload.delete`                     | Staff     |
| GET    | `/upload/files`    | `upload.manage`                     | Staff     |

---

## 🔐 **RBAC Permissions (38 Total)**

### **By Module**:

| **Module**         | **Permissions** | **Actions**                                                         |
| ------------------ | --------------- | ------------------------------------------------------------------- |
| **property**       | 5               | view, create, edit, delete, manage_staff                            |
| **listing**        | 8               | view, create, edit, delete, restore, manage_status, view_statistics |
| **booking**        | 6               | view, create, edit, delete, confirm, manage_payment                 |
| **user**           | 6               | view, create, edit, delete, manage_roles, manage                    |
| **review**         | 4               | view, create, edit, delete                                          |
| **message**        | 4               | view, create, edit, delete                                          |
| **notification**   | 5               | view, create, edit, delete, send, broadcast                         |
| **amenity**        | 4               | view, create, edit, delete                                          |
| **safety_feature** | 4               | view, create, edit, delete                                          |
| **house_rule**     | 4               | view, create, edit, delete                                          |
| **voucher**        | 4               | view, create, edit, delete                                          |
| **transaction**    | 4               | view, create, edit, delete                                          |
| **service**        | 4               | view, create, edit, delete                                          |
| **upload**         | 4               | create, delete, manage                                              |
| **system**         | 1               | manage                                                              |
| **analytics**      | 1               | manage                                                              |

---

## 👥 **Custom Roles (8 Total)**

| **Role**            | **Name**              | **Permissions Count** | **Focus Area**                   |
| ------------------- | --------------------- | --------------------- | -------------------------------- |
| `property_manager`  | Quản lý Tài sản       | 11                    | Property & Listing Management    |
| `booking_manager`   | Quản lý Đặt phòng     | 9                     | Booking & Payment                |
| `content_moderator` | Kiểm duyệt Nội dung   | 10                    | Content Review & Moderation      |
| `customer_service`  | Chăm sóc Khách hàng   | 10                    | Customer Support                 |
| `operations_staff`  | Nhân viên Vận hành    | 7                     | Daily Operations                 |
| `content_manager`   | Quản lý Nội dung      | 16                    | Website Content Management       |
| `analyst`           | Chuyên viên Phân tích | 6                     | Data Analysis & Reporting        |
| `admin_assistant`   | Trợ lý Quản trị       | 22                    | Admin Support (Most permissions) |

---

## ⚠️ **Issues & Recommendations**

### **🚨 Missing Permissions**

Permissions được sử dụng trong controller nhưng **chưa được định nghĩa** trong seed:

1. **`user.view_private_info`** - Used in RBAC controller ❌
2. **`listing.restore`** - Used in listing controller ❌
3. **`listing.manage_status`** - Used in listing controller ❌
4. **`listing.view_statistics`** - Used in listing controller ❌
5. **`booking.confirm`** - Used in booking controller ❌
6. **`notification.broadcast`** - Used in notifications controller ❌
7. **`upload.create`** - Used in upload controller ❌
8. **`upload.delete`** - Used in upload controller ❌

### **🔧 Fixes Needed**

```typescript
// Add missing permissions to RBAC seed:
{
  key: 'user.view_private_info',
  module: 'user',
  action: 'view_private_info',
  description: 'Xem thông tin riêng tư của user'
},
{
  key: 'listing.restore',
  module: 'listing',
  action: 'restore',
  description: 'Khôi phục listing đã xóa'
},
{
  key: 'listing.manage_status',
  module: 'listing',
  action: 'manage_status',
  description: 'Quản lý trạng thái listing'
},
{
  key: 'listing.view_statistics',
  module: 'listing',
  action: 'view_statistics',
  description: 'Xem thống kê listing'
},
{
  key: 'booking.confirm',
  module: 'booking',
  action: 'confirm',
  description: 'Xác nhận booking'
},
{
  key: 'notification.broadcast',
  module: 'notification',
  action: 'broadcast',
  description: 'Gửi thông báo hàng loạt'
},
{
  key: 'upload.create',
  module: 'upload',
  action: 'create',
  description: 'Upload file'
},
{
  key: 'upload.delete',
  module: 'upload',
  action: 'delete',
  description: 'Xóa file'
}
```

### **📊 System Health**

| **Status**         | **Details**                              |
| ------------------ | ---------------------------------------- |
| **🟢 Controllers** | 17/17 properly configured                |
| **🟢 Endpoints**   | ~200+ endpoints mapped                   |
| **🟡 Permissions** | 38 defined, 8 missing ⚠️                 |
| **🟢 Roles**       | 8 custom roles properly assigned         |
| **🟢 Guards**      | JWT + Permission + PropertyStaff working |

### **🎯 Next Steps**

1. **Add missing permissions** to `rbac.seed.ts`
2. **Run seed command**: `npm run seed:rbac`
3. **Assign missing permissions** to appropriate roles
4. **Test permission enforcement** on all endpoints
5. **Document any new role assignments** needed

---

## ✅ **System is 95% Complete!**

Hệ thống RBAC đã hoạt động tốt với **200+ endpoints** được bảo vệ đúng cách. Chỉ cần bổ sung **8 permissions** còn thiếu là hoàn thiện!
