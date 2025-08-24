# Guest Users Endpoint

## Tổng quan

Endpoint này được tạo để hỗ trợ việc tìm kiếm guest users cho staff/admin khi tạo booking:

**`GET /users/guests`** - Lấy danh sách guest users

## Endpoint

### GET /users/guests

**Mô tả:** Lấy danh sách guest users cho việc tạo booking

**Permission:** `booking.create`

**Headers:**

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Query Parameters:**

- `page` (optional): Số trang (default: 1)
- `limit` (optional): Số lượng items per page (default: 10)
- `keyword` (optional): Từ khóa tìm kiếm (name, email)
- `sortBy` (optional): Sắp xếp theo field (default: createdAt)
- `sortOrder` (optional): Thứ tự sắp xếp - asc/desc (default: desc)
- `is_verified` (optional): Filter theo trạng thái verified
- `createdFrom` (optional): Filter từ ngày tạo
- `createdTo` (optional): Filter đến ngày tạo

**Response:**

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "_id": "user_id",
        "name": "Guest Name",
        "email": "guest@example.com",
        "phone": "0123456789",
        "avatar_url": "https://example.com/avatar.jpg",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "is_verified": true,
        "role": "guest"
      }
    ],
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  },
  "statusCode": 200,
  "message": "Lấy danh sách guest users thành công"
}
```

## Logic Filter

### Tự động áp dụng:

- `role = 'guest'` - Chỉ lấy guest users

## Sử dụng trong Frontend

### Simple Usage:

```javascript
const loadGuestUsers = async (searchKeyword = '') => {
  try {
    const response = await api.get(`/users/guests?keyword=${searchKeyword}`);
    return response.data;
  } catch (error) {
    console.error('Lỗi tải guest users:', error);
    throw error;
  }
};
```

### Search Component:

```javascript
const GuestSearch = () => {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');

  const searchGuests = async (searchTerm) => {
    setLoading(true);
    try {
      const result = await loadGuestUsers(searchTerm);
      setGuests(result.data.data);
    } catch (error) {
      console.error('Lỗi tìm kiếm guest:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Tìm kiếm guest..."
        value={keyword}
        onChange={(e) => {
          setKeyword(e.target.value);
          searchGuests(e.target.value);
        }}
      />

      {loading && <div>Đang tìm kiếm...</div>}

      <div>
        {guests.map((guest) => (
          <div key={guest._id}>
            <span>{guest.name}</span>
            <span>{guest.email}</span>
            <span>{guest.phone}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

## Test Cases

### 1. Test endpoint chính

```bash
curl -X GET \
  "http://localhost:3000/api/v1/users/guests?page=1&limit=10&keyword=test" \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json"
```

### 2. Test với search

```bash
curl -X GET \
  "http://localhost:3000/api/v1/users/guests?keyword=guest&page=1&limit=5" \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json"
```

### 3. Test với pagination

```bash
curl -X GET \
  "http://localhost:3000/api/v1/users/guests?page=2&limit=5" \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json"
```

## Expected Results

- ✅ Chỉ trả về users có `role = 'guest'`
- ✅ Hỗ trợ search theo name và email
- ✅ Hỗ trợ pagination
- ✅ Hỗ trợ sorting
- ✅ Hỗ trợ filtering theo `is_verified`
- ✅ Hỗ trợ filtering theo date range
- ✅ Permission check: `booking.create`

## Files Modified

### `src/modules/users/users.controller.ts`

- Thêm endpoint `GET /users/guests`
- Permission: `booking.create`
- Force filter `role = 'guest'`

### `test/users-guests-endpoints.test.http`

- Test cases cho endpoint mới
- Test với các query parameters khác nhau

## Related Issues

- **Booking Creation**: Hỗ trợ staff tạo booking cho guest
- **User Search**: Tìm kiếm guest users hiệu quả
- **Permission Control**: Đảm bảo chỉ staff có quyền booking.create mới access được

## Notes

- Endpoint này được thiết kế để hỗ trợ việc tạo booking của staff
- Tương tự như `/users` nhưng chỉ trả về guest users
- Không expose sensitive information như password hash
