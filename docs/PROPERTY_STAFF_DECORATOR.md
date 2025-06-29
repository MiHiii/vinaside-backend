# @RequirePropertyStaff Decorator

## Mô tả

Decorator `@RequirePropertyStaff()` được sử dụng để kiểm tra xem user hiện tại có phải là staff được gán cho property liên quan không. Decorator này hoạt động cùng với `PropertyStaffGuard` để thực hiện việc kiểm tra quyền.

## Cách hoạt động

1. **Admin bypass**: User có role `admin` sẽ bypass mọi kiểm tra
2. **Extract propertyId**: Lấy propertyId từ request dựa trên options
3. **Kiểm tra staffIds**: Kiểm tra `user._id` có trong `property.staffIds` array không
4. **Throw exception**: Nếu không phải staff → `ForbiddenException`

## Cú pháp

### 1. Sử dụng với tham số string (đơn giản)

```typescript
@RequirePropertyStaff('propertyId') // Lấy từ request.params.propertyId
```

### 2. Sử dụng với options object (linh hoạt)

```typescript
@RequirePropertyStaff({
  propertyIdSource: 'param' | 'body' | 'listing',
  propertyIdParam?: string
})
```

## Các options

### propertyIdSource

- **`'param'`**: Lấy từ request parameters (URL params)
- **`'body'`**: Lấy từ request body
- **`'listing'`**: Lấy từ listing entity (phải query DB trước)

### propertyIdParam

- Tên của property/param chứa propertyId
- Mặc định: `'propertyId'` cho param/body, `'id'` cho listing

## Ví dụ sử dụng

### 1. Property Controller

```typescript
@Controller('properties')
@UseGuards(JwtAuthGuard, PermissionGuard, PropertyStaffGuard)
export class PropertyController {
  @Put(':propertyId/update')
  @RequirePermission('property.edit')
  @RequirePropertyStaff('propertyId') // Lấy từ params.propertyId
  async updateProperty(
    @Param('propertyId') propertyId: string,
    @Body() updateDto: UpdatePropertyDto,
  ) {
    // Chỉ staff của property này hoặc admin mới truy cập được
  }

  @Post('assign-staff')
  @RequirePermission('property.manage_staff')
  @RequirePropertyStaff({ propertyIdSource: 'body' }) // Lấy từ body.propertyId
  async assignStaff(@Body() dto: { propertyId: string; staffIds: string[] }) {
    // Kiểm tra staff permission cho property trong body
  }
}
```

### 2. Listing Controller

```typescript
@Controller('listings')
@UseGuards(JwtAuthGuard, PermissionGuard, PropertyStaffGuard)
export class ListingController {
  @Post()
  @RequirePermission('listing.create')
  @RequirePropertyStaff({
    propertyIdSource: 'body',
    propertyIdParam: 'propertyId',
  })
  async createListing(@Body() createDto: CreateListingDto) {
    // createDto.propertyId sẽ được check
  }

  @Put(':id')
  @RequirePermission('listing.edit')
  @RequirePropertyStaff({ propertyIdSource: 'listing' }) // Lấy propertyId từ listing
  async updateListing(
    @Param('id') id: string, // Đây là listingId
    @Body() updateDto: UpdateListingDto,
  ) {
    // Sẽ query listing theo id, sau đó lấy propertyId để check staff
  }
}
```

### 3. Booking Controller

```typescript
@Controller('bookings')
@UseGuards(JwtAuthGuard, PermissionGuard, PropertyStaffGuard)
export class BookingController {
  @Get('property/:propertyId')
  @RequirePermission('booking.view')
  @RequirePropertyStaff('propertyId')
  async getBookingsByProperty(@Param('propertyId') propertyId: string) {
    // Chỉ staff của property này mới xem được bookings
  }
}
```

## Cách setup

### 1. Thêm Guard vào Controller

```typescript
@UseGuards(JwtAuthGuard, PermissionGuard, PropertyStaffGuard)
export class YourController {
  // ...
}
```

### 2. Import dependencies

```typescript
import { PropertyStaffGuard } from '../../common/guards/property-staff.guard';
import { RequirePropertyStaff } from '../../decorators/require-property-staff.decorator';
```

### 3. Combine với @RequirePermission

```typescript
@Put(':id')
@RequirePermission('listing.edit') // Kiểm tra permission trước
@RequirePropertyStaff({ propertyIdSource: 'listing' }) // Sau đó kiểm tra staff
async updateListing() {
  // Cả 2 điều kiện phải thỏa mãn
}
```

## Thứ tự thực hiện

1. `JwtAuthGuard` - Xác thực user
2. `PermissionGuard` - Kiểm tra permission (@RequirePermission)
3. `PropertyStaffGuard` - Kiểm tra staff access (@RequirePropertyStaff)

## Lưu ý

- **Admin bypass**: Admin luôn được phép truy cập
- **Performance**: Option `'listing'` cần query thêm để lấy propertyId
- **Error handling**: Throw `ForbiddenException` nếu không phải staff
- **Combine decorators**: Có thể kết hợp với `@RequirePermission()`

## Lợi ích

✅ **DRY**: Không lặp lại logic kiểm tra staff  
✅ **Declarative**: Rõ ràng về permission ở controller level  
✅ **Flexible**: Support nhiều cách lấy propertyId  
✅ **Type-safe**: TypeScript support đầy đủ  
✅ **Consistent**: Theo pattern của `@RequirePermission`
