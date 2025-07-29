# 🚀 Staff Filtering Universal Guide

## 🎯 Tổng Quan

Giải pháp **Universal Staff Filtering** cho phép áp dụng staff filtering cho **TẤT CẢ** các module mà chỉ cần sửa **1 chỗ**. Không cần sửa từng service riêng lẻ!

## 🏗️ Kiến Trúc Giải Pháp

### 1. Core Components

#### A. Utility Function (`src/utils/staff-filter.util.ts`)

```typescript
import {
  applyStaffFilter,
  createEmptyResult,
} from '../utils/staff-filter.util';

// Trong service method
const filteredQuery = applyStaffFilter(baseQuery, request, 'propertyId');
```

#### B. Base Repository (`src/database/repo/staff-filtered-base.repo.ts`)

```typescript
// Kế thừa từ StaffFilteredBaseRepo thay vì BaseRepo
export class YourRepo extends StaffFilteredBaseRepo<YourDocument> {
  // Tự động có staff filtering!
}
```

#### C. Base Service (`src/common/services/staff-filtered-base.service.ts`)

```typescript
// Kế thừa từ StaffFilteredBaseService
export class YourService extends StaffFilteredBaseService {
  // Có sẵn các method staff filtering!
}
```

## 🔧 Cách Sử Dụng

### Phương Pháp 1: Utility Function (Đơn Giản Nhất)

#### Bước 1: Import Utility

```typescript
import {
  applyStaffFilter,
  createEmptyResult,
} from '../../../utils/staff-filter.util';
```

#### Bước 2: Sử Dụng Trong Service

```typescript
async findAll(queryDto: QueryDto, user?: JwtPayload, request?: any) {
  const { page = 1, limit = 10, ...filters } = queryDto;

  // Build base query
  const baseQuery: FilterQuery<YourDocument> = { isDeleted: false };

  // Apply staff filtering
  const filteredQuery = applyStaffFilter(baseQuery, request, 'propertyId');

  // If staff has no assigned properties, return empty
  if (user?.role === 'staff' && (!request?.staffPropertyIds || request.staffPropertyIds.length === 0)) {
    return createEmptyResult(page, limit);
  }

  // Execute query with filtered query
  const [data, total] = await Promise.all([
    this.model.find(filteredQuery).skip(skip).limit(limit).exec(),
    this.model.countDocuments(filteredQuery),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}
```

#### Bước 3: Cập Nhật Controller

```typescript
@Get()
@StaffFiltered({ propertyField: 'propertyId' })
findAll(@Query() queryDto: QueryDto, @Request() req: RequestWithUser) {
  return this.service.findAll(queryDto, req.user, req);
}
```

### Phương Pháp 2: Base Repository (Cho Repository Pattern)

#### Bước 1: Tạo Repository Kế Thừa

```typescript
// src/modules/your-module/your.repo.ts
import { StaffFilteredBaseRepo } from '../../database/repo/staff-filtered-base.repo';

@Injectable()
export class YourRepo extends StaffFilteredBaseRepo<YourDocument> {
  constructor(@InjectModel(Your.name) model: Model<YourDocument>) {
    super(model);
  }

  // Tất cả methods đã có staff filtering!
}
```

#### Bước 2: Sử Dụng Trong Service

```typescript
async findAll(queryDto: QueryDto, request?: any) {
  const { page = 1, limit = 10, ...filters } = queryDto;

  const result = await this.repo.findWithPagination(
    { isDeleted: false, ...filters },
    {
      page,
      limit,
      request, // Pass request để apply staff filter
      propertyField: 'propertyId', // Field chứa property ID
    }
  );

  return result;
}
```

### Phương Pháp 3: Base Service (Cho Service Pattern)

#### Bước 1: Tạo Service Kế Thừa

```typescript
// src/modules/your-module/your.service.ts
import { StaffFilteredBaseService } from '../../common/services/staff-filtered-base.service';

@Injectable()
export class YourService extends StaffFilteredBaseService {
  constructor(
    @InjectModel(Your.name) private model: Model<YourDocument>,
    private staffFilterService: StaffFilterService,
  ) {
    super(staffFilterService);
  }

  async findAll(queryDto: QueryDto, request?: any) {
    const { page = 1, limit = 10, ...filters } = queryDto;

    // Build base query
    const baseQuery = { isDeleted: false, ...filters };

    // Apply staff filter
    const filteredQuery = this.applyStaffFilter(
      baseQuery,
      request,
      'propertyId',
    );

    // Execute query
    const [data, total] = await Promise.all([
      this.model.find(filteredQuery).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filteredQuery),
    ]);

    return this.createPaginatedResult(data, total, page, limit);
  }
}
```

## 📋 Checklist Áp Dụng Cho Từng Module

### ✅ Property Module

- [x] PropertyService.findAll() - Sử dụng utility function
- [x] PropertyController.findAll() - Truyền request

### 🔄 Listing Module

- [ ] ListingService.findAll() - Áp dụng utility function
- [ ] ListingController.findAll() - Truyền request

### 🔄 Review Module

- [ ] ReviewService.findAll() - Áp dụng utility function
- [ ] ReviewController.findAll() - Truyền request

### 🔄 Booking Module

- [ ] BookingService.findAll() - Áp dụng utility function
- [ ] BookingController.findAll() - Truyền request

### 🔄 Transaction Module

- [ ] TransactionService.findAll() - Áp dụng utility function
- [ ] TransactionController.findAll() - Truyền request

## 🚀 Quick Implementation

### 1. Copy-Paste Template cho Service

```typescript
async findAll(queryDto: QueryDto, user?: JwtPayload, request?: any) {
  const { page = 1, limit = 10, ...filters } = queryDto;
  const skip = (page - 1) * limit;

  // Build base query
  const baseQuery: FilterQuery<YourDocument> = { isDeleted: false };

  // Apply staff filtering
  const filteredQuery = applyStaffFilter(baseQuery, request, 'propertyId');

  // If staff has no assigned properties, return empty result
  if (user?.role === 'staff' && (!request?.staffPropertyIds || request.staffPropertyIds.length === 0)) {
    return createEmptyResult(page, limit);
  }

  // Execute query
  const [data, total] = await Promise.all([
    this.model.find(filteredQuery).skip(skip).limit(limit).exec(),
    this.model.countDocuments(filteredQuery),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}
```

### 2. Copy-Paste Template cho Controller

```typescript
@Get()
@StaffFiltered({ propertyField: 'propertyId' })
findAll(@Query() queryDto: QueryDto, @Request() req: RequestWithUser) {
  return this.service.findAll(queryDto, req.user, req);
}
```

## 🎯 Lợi Ích

### ✅ **Chỉ Sửa 1 Chỗ**

- Import utility function
- Thay đổi 3-5 dòng code
- Áp dụng cho toàn bộ module

### ✅ **Consistent Logic**

- Tất cả modules sử dụng cùng logic
- Dễ maintain và debug
- Type-safe với TypeScript

### ✅ **Performance Optimized**

- Pre-calculated property IDs từ interceptor
- Single database query
- No additional overhead

### ✅ **Security First**

- Default empty result cho security
- Cannot bypass filtering
- Comprehensive error handling

## 🔧 Advanced Usage

### Custom Property Field

```typescript
// Nếu field khác tên
const filteredQuery = applyStaffFilter(baseQuery, request, 'property_id');
```

### Multiple Property Fields

```typescript
// Cho complex queries
const filteredQuery = applyStaffFilter(
  baseQuery,
  request,
  'listing.propertyId',
);
```

### Custom Filter Logic

```typescript
// Nếu cần custom logic
if (user?.role === 'staff') {
  const staffPropertyIds = await this.getStaffPropertyIds(user, request);
  // Custom logic here
}
```

## 🧪 Testing

### Test Cases

```typescript
// Admin should see all
// Staff should see only assigned properties
// Staff with no assignments should see empty result
// Other roles should see empty result
```

### HTTP Tests

```http
### Admin test
GET /api/properties
Authorization: Bearer <admin-token>

### Staff test
GET /api/properties
Authorization: Bearer <staff-token>
```

## 📈 Performance Monitoring

### Metrics to Track

- Query execution time
- Number of filtered results
- Staff property assignment cache hits
- Error rates

### Optimization Tips

- Use indexes on propertyId fields
- Cache staff property assignments
- Monitor query performance
- Use aggregation for complex queries

---

**🎉 Với giải pháp này, bạn chỉ cần sửa 1 chỗ và áp dụng cho toàn bộ hệ thống!**
