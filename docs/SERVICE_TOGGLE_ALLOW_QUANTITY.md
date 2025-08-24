# Service Toggle Allow Quantity Endpoint

## Tổng quan

Endpoint để toggle trạng thái `allow_quantity` của service từ `true` sang `false` hoặc ngược lại.

## Endpoint

```
PUT /api/v1/services/:id/toggle-allow-quantity
```

## Request

**Headers:**

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Parameters:**

- `id` (string): Service ID

**Body:** Không cần body

## Response

### Success (200)

```json
{
  "success": true,
  "message": "Thay đổi trạng thái allow_quantity thành công",
  "data": {
    "_id": "687a91e11a48e97f537b07e8",
    "name": "Giặt ủi",
    "description": "Dịch vụ giặt ủi quần áo",
    "unit": "/bộ",
    "default_price": 50000,
    "is_active": true,
    "allow_quantity": true, // Đã được toggle
    "created_at": "2025-08-24T08:00:00.000Z",
    "updated_at": "2025-08-24T08:30:00.000Z"
  }
}
```

### Error (400) - Invalid ID

```json
{
  "statusCode": 400,
  "message": "ID không hợp lệ",
  "error": "Bad Request"
}
```

### Error (404) - Service not found

```json
{
  "statusCode": 404,
  "message": "Không tìm thấy dịch vụ với ID: service_id",
  "error": "Not Found"
}
```

## Validation

- ✅ Service ID phải hợp lệ (MongoDB ObjectId)
- ✅ Service phải tồn tại trong database
- ✅ User phải có permission `service.edit`

## Logic

1. Validate service ID
2. Tìm service trong database
3. Toggle `allow_quantity` từ `true` sang `false` hoặc ngược lại
4. Cập nhật `updated_at` timestamp
5. Trả về service data đã được cập nhật

## Usage Examples

### Frontend Integration

```javascript
const toggleServiceAllowQuantity = async (serviceId) => {
  try {
    const response = await fetch(
      `/api/v1/services/${serviceId}/toggle-allow-quantity`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (response.ok) {
      const result = await response.json();
      // Update UI với service data mới
      updateServiceData(result.data);
    } else {
      const errorData = await response.json();
      console.error('Error toggling allow_quantity:', errorData.message);
    }
  } catch (error) {
    console.error('Error toggling allow_quantity:', error);
  }
};
```

### cURL Example

```bash
# Toggle allow_quantity
curl -X PUT \
  http://localhost:3000/api/v1/services/687a91e11a48e97f537b07e8/toggle-allow-quantity \
  -H 'Authorization: Bearer your_jwt_token' \
  -H 'Content-Type: application/json'
```

## Files Modified

### `src/modules/services/services.controller.ts`

- Thêm endpoint `PUT /:id/toggle-allow-quantity`
- Permission: `service.edit`

### `src/modules/services/services.service.ts`

- Thêm method `toggleAllowQuantity()`
- Validation và error handling

### `src/modules/services/services.repo.ts`

- Thêm method `toggleAllowQuantity()`
- Database update logic

### `test/service-toggle-allow-quantity.test.http`

- Test cases cho endpoint

## Testing

Sử dụng test file `test/service-toggle-allow-quantity.test.http`:

1. **Toggle từ false sang true**
2. **Toggle từ true sang false**
3. **Test invalid service ID**
4. **Test service không tồn tại**
5. **Verify response data**

## Related Features

- **Service Management**: Admin có thể quản lý thuộc tính `allow_quantity`
- **Booking Services**: `allow_quantity` ảnh hưởng đến việc chọn số lượng service
- **Validation**: Service không allow_quantity sẽ force quantity = 1

## Impact

- ✅ Admin/Staff có thể toggle allow_quantity dễ dàng
- ✅ UI có thể hiển thị toggle button
- ✅ Booking validation dựa trên allow_quantity
- ✅ Consistent với toggle-status endpoint
