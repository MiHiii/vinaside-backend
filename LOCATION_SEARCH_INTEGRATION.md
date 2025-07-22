# Tích hợp tìm kiếm Listing theo Location

## Tổng quan

Hệ thống đã được tích hợp để hỗ trợ tìm kiếm listing theo vị trí địa lý. Listing không có địa chỉ riêng mà sử dụng location từ Property parent của nó.

## Cấu trúc dữ liệu Location

Property có cấu trúc location như sau:

```typescript
location: {
  place_id?: string;  // Google Places ID (ưu tiên cao nhất)
  lat: number;        // Vĩ độ
  lng: number;        // Kinh độ
  address: string;    // Địa chỉ đầy đủ
  city?: string;      // Thành phố
  district?: string;  // Quận/Huyện
  ward?: string;      // Phường/Xã
  coordinates?: [number, number]; // [lng, lat] cho geospatial queries
}
```

## API Endpoints

### 1. Tìm kiếm listing với location filters (GET /listings)

Endpoint hiện có đã được mở rộng để hỗ trợ các tham số location:

```typescript
// Query parameters mới:
{
  // Location filters (theo thứ tự ưu tiên)
  place_id?: string;       // Google Places ID (ưu tiên cao nhất)
  fuzzy_place_search?: boolean; // Enable fuzzy search cho place_id (default: true)
  city?: string;           // Tìm theo thành phố
  district?: string;       // Tìm theo quận/huyện
  ward?: string;          // Tìm theo phường/xã
  address?: string;       // Tìm theo địa chỉ
  locationKeyword?: string; // Tìm kiếm keyword trong tất cả trường location

  // Geospatial search
  lat?: number;           // Vĩ độ
  lng?: number;           // Kinh độ
  radius?: number;        // Bán kính tìm kiếm (km), default = 10
}
```

### 2. Tìm kiếm listing gần vị trí (GET /listings/location/nearby)

Endpoint mới chuyên dụng cho tìm kiếm theo khoảng cách:

```typescript
GET /listings/location/nearby?lat=21.0285&lng=105.8542&radius=5&page=1&limit=10
```

## Ví dụ sử dụng

### 1. Tìm kiếm listing theo Google Places ID (chính xác nhất)

```bash
# Exact + Fuzzy search (default)
GET /listings?place_id=ChIJL2qFlgcbdTERTVVVVVFVlFV&page=1&limit=10

# Chỉ exact search (không fuzzy)
GET /listings?place_id=ChIJL2qFlgcbdTERTVVVVVFVlFV&fuzzy_place_search=false

# Test fuzzy search với place_id gần đó
GET /listings?place_id=ChIJrRMbVhisNTERQjUIbXYWrCQ&fuzzy_place_search=true
```

### 2. Tìm kiếm listing tại Hà Nội

```bash
GET /listings?city=Hà Nội&page=1&limit=10
```

### 3. Tìm kiếm listing tại quận Cầu Giấy, Hà Nội

```bash
GET /listings?city=Hà Nội&district=Cầu Giấy&page=1&limit=10
```

### 4. Tìm kiếm listing với từ khóa location

```bash
GET /listings?locationKeyword=Mai Dịch&page=1&limit=10
```

### 5. Tìm kiếm listing trong bán kính 5km từ tọa độ

```bash
GET /listings?lat=21.0285&lng=105.8542&radius=5&page=1&limit=10
```

### 6. Tìm kiếm gần vị trí với khoảng cách chính xác

```bash
GET /listings/location/nearby?lat=21.0285&lng=105.8542&radius=5&page=1&limit=10
```

Response sẽ bao gồm thêm trường `distance` (km):

```json
{
  "data": [
    {
      "_id": "...",
      "title": "Beautiful Apartment",
      "propertyId": {
        "name": "Villa Complex",
        "location": {
          "address": "Mai Dịch",
          "city": "Hà Nội",
          "district": "Cầu Giấy"
        }
      },
      "distance": 2.5
      // ... other fields
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "limit": 10,
    "totalPages": 3
  }
}
```

## Kết hợp filters

Có thể kết hợp location search với các filter khác:

```bash
GET /listings?city=Hà Nội&priceFrom=500000&priceTo=2000000&guests=2&status=active
```

## Hiệu suất

- Location search sử dụng MongoDB indexes để tối ưu hiệu suất
- Geospatial search sử dụng 2dsphere index cho độ chính xác cao
- Text search trên location fields được index để tăng tốc

## Thứ tự ưu tiên tìm kiếm

Hệ thống sẽ tìm kiếm theo thứ tự ưu tiên như sau:

1. **place_id** (Google Places ID) - Smart search với 2 mức độ:
   - **Exact match**: Tìm property có place_id chính xác
   - **Fuzzy match**: Nếu không tìm thấy exact, sẽ tìm properties trong bán kính 2km của place_id đó
2. **city + district + ward** - Kết hợp các trường địa chính
3. **address + locationKeyword** - Tìm kiếm theo địa chỉ và từ khóa
4. **lat/lng + radius** - Tìm kiếm theo tọa độ địa lý

## Tạo Property với place_id

Khi tạo property mới, nên bao gồm `place_id` để tăng độ chính xác tìm kiếm:

```typescript
POST /properties
{
  "name": "Villa Mai Dịch",
  "type": "villa",
  "location": {
    "place_id": "ChIJL2qFlgcbdTERTVVVVVFVlFV", // Từ Google Places
    "lat": 21.0285,
    "lng": 105.8542,
    "address": "Mai Dịch, Cầu Giấy, Hà Nội",
    "city": "Hà Nội",
    "district": "Cầu Giấy",
    "ward": "Mai Dịch"
  }
}
```

## Fuzzy Place ID Search

### Cách hoạt động:

1. **Exact match**: Tìm property có place_id chính xác với input
2. **Fuzzy match**: Nếu không tìm thấy exact, sẽ:
   - Gọi Google Places API để lấy tọa độ của place_id input
   - Tìm tất cả properties trong bán kính 2km từ tọa độ đó
   - Return kết quả gần nhất

### Use cases:

- User search "ChIJXXX" (place_id của đường), system tìm properties gần đường đó
- User search place_id của tòa nhà, system tìm properties trong khu vực đó
- Flexible search cho user experience tốt hơn

### Cấu hình:

```bash
# Default: fuzzy search enabled
GET /listings?place_id=XXX

# Disable fuzzy search (chỉ exact match)
GET /listings?place_id=XXX&fuzzy_place_search=false
```

## Notes

1. **place_id validation**: Khi tạo property, system sẽ validate place_id với Google Places API
2. **Fuzzy search**: Default enabled với bán kính 2km, có thể disable bằng `fuzzy_place_search=false`
3. Property schema đã được thêm middleware để tự động tạo `coordinates` field từ `lat/lng`
4. Existing data cần migration để thêm `coordinates` và `place_id` fields
5. Để chính xác nhất, nên sử dụng endpoint `/listings/location/nearby` cho tìm kiếm theo khoảng cách
6. Location filters có thể kết hợp với nhau, nhưng place_id sẽ được ưu tiên trước
7. **Migration**: Chạy migration script để cập nhật existing properties với coordinates và place_id
