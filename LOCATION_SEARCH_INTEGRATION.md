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
GET /listings?place_id=ChIJL2qFlgcbdTERTVVVVVFVlFV&page=1&limit=10
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

1. **place_id** (Google Places ID) - Chính xác nhất, nếu tìm thấy sẽ return ngay
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

## Notes

1. **place_id validation**: Khi tạo property, system sẽ validate place_id với Google Places API
2. Property schema đã được thêm middleware để tự động tạo `coordinates` field từ `lat/lng`
3. Existing data cần migration để thêm `coordinates` và `place_id` fields
4. Để chính xác nhất, nên sử dụng endpoint `/listings/location/nearby` cho tìm kiếm theo khoảng cách
5. Location filters có thể kết hợp với nhau, nhưng place_id sẽ được ưu tiên trước
6. **Migration**: Chạy migration script để cập nhật existing properties với coordinates và place_id
