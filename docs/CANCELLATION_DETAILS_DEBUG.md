# Debug Guide: Cancellation Details API Error 500

## Vấn đề
API `GET /bookings/:propertyId/:id/cancellation-details` trả về lỗi 500 "Internal server error"

## Nguyên nhân có thể

### 1. **Database Connection Issues**
- MongoDB service không chạy
- Biến môi trường `MONGODB_URI` không đúng
- Network issues đến MongoDB

### 2. **Schema Issues**
- Các trường `cancellationDetails` chưa được tạo trong database
- Migration chưa chạy
- Schema mismatch giữa code và database

### 3. **ObjectId Validation Issues**
- `propertyId` hoặc `bookingId` không phải MongoDB ObjectId hợp lệ
- ID rỗng hoặc null

### 4. **Permission Issues**
- User không có quyền `booking.view`
- JWT token không hợp lệ hoặc hết hạn

## Cách Debug

### 1. **Kiểm tra Database Connection**
```bash
# Chạy script kiểm tra
node scripts/check-db-connection.js

# Hoặc kiểm tra MongoDB trực tiếp
mongosh --eval "db.runCommand('ping')"
```

### 2. **Kiểm tra Environment Variables**
```bash
# Kiểm tra MONGODB_URI
echo $MONGODB_URI

# Kiểm tra file .env
cat .env | grep MONGODB
```

### 3. **Kiểm tra Logs**
```bash
# Chạy ứng dụng với debug mode
npm run start:debug

# Xem logs trong console
```

### 4. **Test API với các trường hợp khác nhau**
Sử dụng file `test/cancellation-details-debug.http` để test:
- ID hợp lệ
- ID không hợp lệ
- Không có token
- ID rỗng

### 5. **Kiểm tra Database Schema**
```javascript
// Trong MongoDB shell
use vinaside
db.bookings.findOne({}, {cancellationDetails: 1, cancellationDetailsUpdatedAt: 1, cancellationDetailsUpdatedBy: 1})
```

## Cách khắc phục

### 1. **Sửa Database Connection**
```bash
# Đảm bảo MongoDB đang chạy
sudo systemctl start mongod

# Kiểm tra port
netstat -tlnp | grep 27017
```

### 2. **Cập nhật Environment Variables**
```bash
# Trong file .env
MONGODB_URI=mongodb://localhost:27017/vinaside
```

### 3. **Chạy Migration nếu cần**
```bash
# Nếu có migration script
npm run seed:rbac
```

### 4. **Kiểm tra Database Schema**
```javascript
// Tạo collection và index nếu cần
db.bookings.createIndex({propertyId: 1, _id: 1})
```

## Code đã được cải thiện

### 1. **Service Layer**
- Thêm validation cho ObjectId
- Thêm error handling chi tiết
- Log errors để debug

### 2. **Controller Layer**
- Thêm try-catch
- Thêm API documentation
- Log errors

### 3. **Error Messages**
- `400`: ID không hợp lệ
- `404`: Không tìm thấy booking
- `500`: Lỗi server (với message chi tiết)

## Test Cases

### ✅ **Trường hợp thành công**
```http
GET /bookings/507f1f77bcf86cd799439011/507f1f77bcf86cd799439012/cancellation-details
Authorization: Bearer <valid_token>
```

### ❌ **Trường hợp lỗi**
```http
# ID không hợp lệ
GET /bookings/invalid-id/507f1f77bcf86cd799439012/cancellation-details

# Không có token
GET /bookings/507f1f77bcf86cd799439011/507f1f77bcf86cd799439012/cancellation-details

# ID rỗng
GET /bookings//507f1f77bcf86cd799439012/cancellation-details
```

## Monitoring

### 1. **Logs cần theo dõi**
- Database connection errors
- ObjectId validation errors
- Permission errors
- General server errors

### 2. **Metrics cần theo dõi**
- API response time
- Error rate
- Database connection status
- Memory usage

## Next Steps

1. **Chạy script kiểm tra database**
2. **Kiểm tra logs của ứng dụng**
3. **Test API với các trường hợp khác nhau**
4. **Kiểm tra quyền của user**
5. **Verify database schema**
