# Property Rooms API Fix - Không trả về phòng bảo trì

## 🔍 **Vấn đề đã gặp:**

Endpoint `GET /api/v1/properties/:id/rooms` đang trả về cả phòng bảo trì (inactive) và draft, điều này không phù hợp cho public API.

## 🛠️ **Giải pháp đã áp dụng:**

### 1. **Sửa endpoint public `/rooms`**

- **Trước**: Chỉ filter `isDeleted: false` → trả về tất cả phòng (active, inactive, draft)
- **Sau**: Filter `isDeleted: false` + `status: ListingStatus.ACTIVE` → chỉ trả về phòng đang hoạt động

### 2. **Thêm endpoint staff `/rooms/all`**

- Endpoint mới cho staff để xem tất cả phòng (bao gồm inactive, draft)
- Yêu cầu permission `property.view`

## 📋 **Chi tiết thay đổi:**

### **File: `src/modules/properties/services/property.service.ts`**

#### **Method `getPropertyRooms()` - Public API**

```typescript
// Trước
.find({
  propertyId: new Types.ObjectId(propertyId),
  isDeleted: false, // Chỉ filter này, không filter status
})

// Sau
.find({
  propertyId: new Types.ObjectId(propertyId),
  isDeleted: false,
  status: ListingStatus.ACTIVE, // Chỉ lấy phòng đang hoạt động
})
```

#### **Method `getAllPropertyRooms()` - Staff API (mới)**

```typescript
// Lấy danh sách tất cả phòng (bao gồm inactive, draft) cho staff
.find({
  propertyId: new Types.ObjectId(propertyId),
  isDeleted: false, // Chỉ filter này, không filter status
})
```

### **File: `src/modules/properties/controllers/property.controller.ts`**

#### **Endpoint Public (đã sửa)**

```typescript
@Public()
@Get(':propertyId/rooms')
@ApiOperation({
  summary: 'Lấy danh sách phòng đang hoạt động trong property (public)',
})
getPropertyRooms(@Param('propertyId') propertyId: string, @Query() queryDto: PropertyRoomsQueryDto) {
  return this.propertyService.getPropertyRooms(propertyId, queryDto);
}
```

#### **Endpoint Staff (mới)**

```typescript
@Get(':propertyId/rooms/all')
@RequirePermission('property.view')
@ApiOperation({
  summary: 'Lấy danh sách tất cả phòng trong property (staff only)',
})
getAllPropertyRooms(@Param('propertyId') propertyId: string, @Query() queryDto: PropertyRoomsQueryDto) {
  return this.propertyService.getAllPropertyRooms(propertyId, queryDto);
}
```

## 🎯 **Kết quả:**

### **Public API (`/rooms`)**

- ✅ Chỉ trả về phòng có status `ACTIVE`
- ✅ Không trả về phòng bảo trì (inactive) hoặc draft
- ✅ Phù hợp cho khách hàng xem

### **Staff API (`/rooms/all`)**

- ✅ Trả về tất cả phòng (active, inactive, draft)
- ✅ Yêu cầu authentication và permission
- ✅ Phù hợp cho staff quản lý

## 📝 **API Endpoints:**

| Method | Endpoint                      | Access | Description                     |
| ------ | ----------------------------- | ------ | ------------------------------- |
| GET    | `/properties/:id/rooms`       | Public | Phòng đang hoạt động            |
| GET    | `/properties/:id/rooms/all`   | Staff  | Tất cả phòng (bao gồm inactive) |
| GET    | `/properties/:id/room-status` | Staff  | Trạng thái booking của phòng    |

## 🔧 **Testing:**

### **Test Public API**

```bash
curl -X GET "https://api.vinaside.com/api/v1/properties/68724f541a705725e8919900/rooms"
# Chỉ trả về phòng active
```

### **Test Staff API**

```bash
curl -X GET "https://api.vinaside.com/api/v1/properties/68724f541a705725e8919900/rooms/all" \
  -H "Authorization: Bearer <staff_token>"
# Trả về tất cả phòng (active, inactive, draft)
```

## ✅ **Lợi ích:**

1. **UX tốt hơn**: Khách hàng chỉ thấy phòng có thể đặt
2. **Bảo mật**: Staff vẫn có thể quản lý tất cả phòng
3. **Tách biệt rõ ràng**: Public vs Staff APIs
4. **Backward compatibility**: Không ảnh hưởng đến API hiện tại

---

**Lưu ý**: Thay đổi này đảm bảo rằng khách hàng sẽ không thấy phòng bảo trì hoặc chưa hoàn thiện, trong khi staff vẫn có thể quản lý đầy đủ tất cả phòng.
