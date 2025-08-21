# Services Allow Quantity Feature

## Tổng quan

Thêm tính năng cho phép/không cho phép nhập số lượng cho các dịch vụ trong hệ thống booking. Mặc định các dịch vụ chỉ có thể chọn 1 lần, nhưng với flag `allow_quantity = true`, dịch vụ có thể được chọn với số lượng tùy ý.

## Database Changes

### Service Schema

Thêm trường mới trong `Service` schema:

```typescript
@Prop({
  type: Boolean,
  required: true,
  default: false,
})
allow_quantity: boolean;
```

- **Default**: `false` (không cho phép nhập số lượng)
- **Type**: Boolean
- **Required**: true

## API Changes

### 1. Create Service

**Endpoint**: `POST /services`

```json
{
  "name": "WiFi miễn phí",
  "description": "Kết nối internet tốc độ cao",
  "unit": "/ngày",
  "default_price": 50000,
  "is_active": true,
  "allow_quantity": false, // Trường mới
  "icon_url": "https://example.com/icon.png"
}
```

### 2. Update Service

**Endpoint**: `PUT /services/:id`

```json
{
  "name": "WiFi miễn phí",
  "allow_quantity": true, // Có thể cập nhật
  "is_active": true
}
```

### 3. Service Response

Tất cả API response liên quan đến services sẽ bao gồm trường `allow_quantity`:

```json
{
  "_id": "...",
  "name": "WiFi miễn phí",
  "description": "Kết nối internet tốc độ cao",
  "unit": "/ngày",
  "default_price": 50000,
  "is_active": true,
  "allow_quantity": false, // Trường mới
  "created_at": "...",
  "updated_at": "..."
}
```

## Booking Integration

### 1. Validation Logic

Khi tạo hoặc cập nhật booking với services:

```typescript
// Kiểm tra allow_quantity cho mỗi service
if (!service.allow_quantity && serviceDto.quantity > 1) {
  throw new BadRequestException(
    `Dịch vụ "${service.name}" không cho phép chọn số lượng. Chỉ có thể chọn 1 lần.`,
  );
}
```

### 2. Auto-correction

Nếu service không allow_quantity, hệ thống sẽ tự động force quantity = 1:

```typescript
let finalQuantity = serviceDto.quantity;
if (!service.allow_quantity) {
  finalQuantity = 1;
}
```

### 3. Booking Response

Booking response sẽ bao gồm thông tin `allow_quantity` cho mỗi service:

```json
{
  "selected_services": [
    {
      "service_id": "...",
      "service_name": "WiFi miễn phí",
      "service_price": 50000,
      "quantity": 1,
      "total_price": 50000,
      "allow_quantity": false // Trường mới
    }
  ]
}
```

## Affected Endpoints

### Services

- `POST /services` - Tạo service mới
- `PUT /services/:id` - Cập nhật service
- `GET /services` - Lấy danh sách services
- `GET /services/:id` - Lấy chi tiết service

### Booking

- `POST /bookings` - Tạo booking (Guest)
- `POST /bookings/staff/create` - Tạo booking (Staff)
- `PATCH /bookings/property/:propertyId/:id` - Cập nhật booking
- `GET /bookings/:id` - Chi tiết booking (bao gồm service info)

## Validation Rules

### 1. Service Creation/Update

- `allow_quantity` phải là boolean
- Mặc định là `false` nếu không được cung cấp

### 2. Booking with Services

- Nếu `allow_quantity = false` và `quantity > 1` → Error
- Nếu `allow_quantity = false` → Auto force `quantity = 1`
- Nếu `allow_quantity = true` → Cho phép `quantity` bất kỳ (>= 1)

## Error Messages

### Service Quantity Not Allowed

```json
{
  "statusCode": 400,
  "message": "Dịch vụ \"WiFi miễn phí\" không cho phép chọn số lượng. Chỉ có thể chọn 1 lần.",
  "error": "Bad Request"
}
```

## Usage Examples

### 1. Service chỉ chọn 1 lần (default)

```json
{
  "name": "WiFi miễn phí",
  "default_price": 0,
  "allow_quantity": false
}
```

Khi booking: `quantity` luôn = 1

### 2. Service có thể chọn nhiều lần

```json
{
  "name": "Suất ăn thêm",
  "default_price": 150000,
  "allow_quantity": true
}
```

Khi booking: `quantity` có thể là 1, 2, 3...

### 3. Frontend Integration

```javascript
// Hiển thị input quantity dựa trên allow_quantity
const renderServiceQuantity = (service) => {
  if (service.allow_quantity) {
    return (
      <input
        type="number"
        min="1"
        value={quantity}
        onChange={handleQuantityChange}
      />
    );
  } else {
    return <span>1 lần</span>;
  }
};
```

## Migration

### Existing Data

- Tất cả services hiện tại sẽ có `allow_quantity = false` (default)
- Không cần migration script vì đã có default value

### Frontend Changes

- Cập nhật form tạo/sửa service để include `allow_quantity`
- Cập nhật booking form để hiển thị quantity input conditionally
- Cập nhật service list để hiển thị thông tin `allow_quantity`

## Related Features

- **Booking Services**: Tính năng này ảnh hưởng trực tiếp đến cách services được thêm vào booking
- **Service Management**: Admin có thể quản lý thuộc tính `allow_quantity` của từng service
- **Price Calculation**: Quantity ảnh hưởng đến total price của service trong booking

## Testing

### Test Cases

1. Tạo service với `allow_quantity = true/false`
2. Cập nhật `allow_quantity` của service
3. Tạo booking với service `allow_quantity = false` và `quantity > 1` (should fail)
4. Tạo booking với service `allow_quantity = true` và `quantity > 1` (should pass)
5. Verify booking response includes `allow_quantity` info

