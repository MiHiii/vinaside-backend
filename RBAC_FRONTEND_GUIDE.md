# 🔐 RBAC System - Hướng dẫn cho Frontend

## 📋 **Tổng quan**

Hệ thống RBAC (Role-Based Access Control) với **Real-time Permission Check**:

- **JWT không chứa permissions** (chỉ chứa user info + custom roles)
- **Permissions được check real-time** ở backend mỗi khi gọi API
- **Admin thay đổi quyền** → User có quyền mới ngay lập tức

## 🔑 **JWT Payload Structure**

```json
{
  "_id": "6878c04406c0cf815670265a",
  "email": "user@example.com",
  "name": "User Name",
  "role": "staff", // System role: guest, staff, admin
  "customRoles": ["building_manager"] // Custom roles từ RBAC
}
```

## 🛡️ **System Roles vs Custom Roles**

### **System Roles** (Fixed):

- `guest` - Khách
- `staff` - Nhân viên
- `admin` - Quản trị viên (bypass tất cả permissions)

### **Custom Roles** (Dynamic):

- `building_manager` - Quản lý tòa nhà
- `content_manager` - Quản lý nội dung
- `property_owner` - Chủ bất động sản
- ... (có thể thêm/sửa qua API)

## 🔐 **Permission Structure**

```
{module}.{action}

Examples:
- amenity.view     - Xem tiện ích
- amenity.create   - Tạo tiện ích
- amenity.edit     - Sửa tiện ích
- amenity.delete   - Xóa tiện ích
- property.manage_staff - Quản lý staff property
```

## 🚀 **Frontend Implementation**

### **1. Không cần check permissions ở FE**

```javascript
// ❌ ĐỪNG LÀM THẾ NÀY
if (user.permissions.includes('amenity.create')) {
  showCreateButton();
}

// ✅ LÀM THẾ NÀY
// Luôn hiện UI, backend sẽ block nếu không có quyền
showCreateButton();
```

### **2. Handle API Errors**

```javascript
try {
  await api.post('/amenities', data);
} catch (error) {
  if (error.status === 403) {
    toast.error('Bạn không có quyền thực hiện hành động này');
  }
}
```

### **3. UI Based on System Roles** (Optional)

```javascript
// Chỉ dùng system roles để ẩn/hiện UI nếu cần
const isAdmin = user.role === 'admin';
const isStaff = user.role === 'staff';

// Admin thấy tất cả
if (isAdmin) {
  showAllMenus();
}
```

## 📡 **API Endpoints**

### **RBAC Management** (`/api/v1/rbac`)

```bash
# Lấy danh sách roles
GET /rbac/roles

# Lấy danh sách permissions
GET /rbac/permissions

# Assign role cho user
POST /rbac/assign-role
{
  "userId": "user_id",
  "roleKey": "building_manager"
}

# Assign permission cho role
POST /rbac/assign-permission
{
  "roleKey": "building_manager",
  "permissionKey": "property.manage_staff"
}
```

### **Protected APIs**

Tất cả protected APIs sẽ:

- ✅ Return `200` nếu có quyền
- ❌ Return `403` nếu không có quyền

## 🔄 **Real-time Updates**

### **Scenario:**

1. User login → JWT: `{ role: "staff", customRoles: ["building_manager"] }`
2. Admin thêm quyền `property.view` cho role `building_manager`
3. User gọi `GET /properties` → ✅ **Có quyền ngay lập tức** (không cần login lại)

### **Caching:**

- Backend cache permissions **5 phút**
- Admin có thể force clear cache qua API

## 🛠️ **Development Tips**

### **1. API Testing**

```bash
# Test với different users
curl -H "Authorization: Bearer USER_TOKEN" \
     GET /api/v1/amenities

# Expected responses:
# 200 - Success (có quyền)
# 403 - Forbidden (không có quyền)
```

### **2. Error Handling Pattern**

```javascript
const handleApiCall = async (apiCall) => {
  try {
    return await apiCall();
  } catch (error) {
    switch (error.status) {
      case 403:
        toast.error('Không có quyền truy cập');
        break;
      case 401:
        logout(); // Token expired
        break;
      default:
        toast.error('Có lỗi xảy ra');
    }
    throw error;
  }
};
```

## 💡 **Best Practices**

1. **Don't rely on frontend permission checks** - Backend is source of truth
2. **Always handle 403 errors gracefully**
3. **Use system roles for major UI differences** (admin panel vs user panel)
4. **Let backend handle permission logic** - Frontend focus on UX
5. **Show loading states** during API calls

## 🚨 **Common Mistakes**

❌ **Trying to check permissions in frontend**
❌ **Hiding UI based on JWT permissions** (JWT doesn't contain permissions)
❌ **Not handling 403 errors properly**
❌ **Assuming permissions are static**

✅ **Let backend validate everything**
✅ **Handle API responses properly**
✅ **Focus on good UX for permission denied cases**

---

**Questions?** Ask backend team or check `/rbac` endpoints for current permissions structure.
