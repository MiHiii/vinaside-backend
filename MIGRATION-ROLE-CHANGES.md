# Role Migration: Host → Staff

Tài liệu tóm tắt việc thay đổi role model từ `guest, host, admin` sang `guest, staff, admin` trong hệ thống VinaSide Backend.

## 📋 Tổng quan

**Thay đổi:** Vai trò `host` được đổi thành `staff` trong toàn bộ hệ thống.

**Lý do:** Cập nhật business model để phù hợp với hệ thống quản lý mới.

## 🔄 Các file đã được cập nhật

### 1. Core Schema & DTOs

- ✅ `src/modules/users/schemas/user.schema.ts` - Enum role trong schema
- ✅ `src/modules/users/dto/create-user.dto.ts` - Validation enum
- ✅ `src/modules/users/dto/query-user.dto.ts` - Query validation
- ✅ `src/modules/notifications/schemas/notification.schema.ts` - RecipientType enum

### 2. Controllers (Permission Updates)

- ✅ `src/modules/upload/upload.controller.ts` - @Roles('host') → @Roles('staff')
- ✅ `src/modules/notifications/notifications.controller.ts` - @Roles('host') → @Roles('staff')
- ✅ `src/modules/listing/listing.controller.ts` - @Roles('host') → @Roles('staff')
- ✅ `src/modules/safety_features/safety_features.controller.ts` - @Roles('host') → @Roles('staff')
- ✅ `src/modules/house-rules/house-rules.controller.ts` - @Roles('host') → @Roles('staff')
- ✅ `src/modules/amenities/amenities.controller.ts` - @Roles('host') → @Roles('staff')
- ✅ `src/modules/booking/booking.controller.ts` - @Roles('host') → @Roles('staff')
- ✅ `src/modules/messages/messages.controller.ts` - @Roles('host') → @Roles('staff')

### 3. Services (Business Logic)

- ✅ `src/modules/listing/listing.service.ts` - findByHost() → findByStaff()
- ✅ `src/modules/listing/listing.repo.ts` - Permission checks
- ✅ `src/modules/safety_features/safety_features.service.ts` - validateHost() → validateStaff()
- ✅ `src/modules/house-rules/houserules.service.ts` - validateHost() → validateStaff()
- ✅ `src/modules/amenities/amenities.service.ts` - validateHost() → validateStaff()
- ✅ `src/modules/booking/booking.service.ts` - Permission checks
- ✅ `src/modules/booking/booking.repo.ts` - Role validation

## 🗄️ Database Migration

### Script Migration

File: `migration-role-host-to-staff.js`

**Chức năng:**

- Cập nhật `users.role` từ 'host' → 'staff'
- Cập nhật `notifications.recipient_type` từ 'host' → 'staff'
- Cập nhật các collection khác nếu có
- Verification sau migration

**Chạy migration:**

```bash
# Đảm bảo MongoDB đang chạy
node migration-role-host-to-staff.js
```

### Collections được cập nhật:

1. **users** - Trường `role`
2. **notifications** - Trường `recipient_type`
3. **audit_logs** - Trường `user.role` (nếu có)
4. **user_sessions** - Trường `user.role` (nếu có)

## 🔒 Impact Analysis

### API Endpoints

**Trước:**

```javascript
@Roles('host') // Chỉ host được phép
@Roles('guest', 'host', 'admin') // Host được bao gồm
```

**Sau:**

```javascript
@Roles('staff') // Chỉ staff được phép
@Roles('guest', 'staff', 'admin') // Staff được bao gồm
```

### Business Logic

**Trước:**

```javascript
if (user.role !== 'host') {
  throw new UnauthorizedException('Chỉ host mới có quyền');
}
```

**Sau:**

```javascript
if (user.role !== 'staff') {
  throw new ForbiddenException('Chỉ staff mới có quyền');
}
```

### Database Schema

**Trước:**

```javascript
enum: ['guest', 'host', 'admin'];
```

**Sau:**

```javascript
enum: ['guest', 'staff', 'admin'];
```

## 🧪 Testing Requirements

### 1. Authentication Tests

- ✅ Verify users with role 'staff' can access staff endpoints
- ✅ Verify users with role 'host' are denied (should not exist after migration)
- ✅ Verify guest and admin roles work as expected

### 2. API Endpoint Tests

- ✅ Test all endpoints with staff role
- ✅ Test permission denied for non-staff users
- ✅ Test multi-role endpoints work correctly

### 3. Database Integrity

- ✅ Verify no users have role 'host' after migration
- ✅ Verify all staff users can perform their operations
- ✅ Verify foreign key relationships still work

## 🚀 Deployment Checklist

### Pre-Deployment

- [ ] Backup current database
- [ ] Test migration script on staging environment
- [ ] Verify all users with role 'host' are identified
- [ ] Test application with new role structure

### Deployment Steps

1. [ ] Stop application servers
2. [ ] Run database migration script
3. [ ] Deploy new application code
4. [ ] Start application servers
5. [ ] Verify system functionality

### Post-Deployment

- [ ] Verify no 'host' roles exist in database
- [ ] Test staff user login and permissions
- [ ] Test API endpoints with staff role
- [ ] Monitor error logs for role-related issues
- [ ] Update any documentation or user guides

## 🔍 Verification Commands

### MongoDB Verification

```javascript
// Check role distribution
db.users.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]);

// Should return something like:
// { "_id": "guest", "count": 150 }
// { "_id": "staff", "count": 25 }
// { "_id": "admin", "count": 5 }
// No 'host' should appear

// Check notifications
db.notifications.aggregate([
  { $group: { _id: '$recipient_type', count: { $sum: 1 } } },
]);
```

### API Testing

```bash
# Test staff endpoint access
curl -H "Authorization: Bearer <staff_token>" \
     -X GET http://localhost:3000/api/v1/listing

# Should return 200 OK

# Test host token (should fail if migration successful)
curl -H "Authorization: Bearer <old_host_token>" \
     -X GET http://localhost:3000/api/v1/listing

# Should return 401/403
```

## ❗ Known Issues & Considerations

### Potential Issues

1. **JWT Tokens:** Existing JWT tokens with role 'host' will be invalid
2. **Client Applications:** Frontend apps need to handle new role name
3. **External Systems:** Any integrations using role 'host' need updates
4. **Cached Data:** Clear any Redis/cache containing user role data

### Rollback Plan

If needed, run reverse migration:

```javascript
// Rollback script (create if needed)
db.users.updateMany({ role: 'staff' }, { $set: { role: 'host' } });
db.notifications.updateMany(
  { recipient_type: 'staff' },
  { $set: { recipient_type: 'host' } },
);
```

## 📞 Support

Nếu gặp vấn đề sau migration:

1. Check application logs for role-related errors
2. Verify database migration completed successfully
3. Test với user account cụ thể có role 'staff'
4. Check JWT token payload contains correct role

---

**Migration Date:** [Date when migration was run]  
**Migration Status:** ✅ Completed / ❌ Failed / ⏳ Pending  
**Verified By:** [Team member who verified]
