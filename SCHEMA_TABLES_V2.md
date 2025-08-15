# 📊 Database Schema Tables - Vinaside Backend

## 📈 Tình trạng Collections (13/8/2025)

### ✅ Collections đã có trong MongoDB (8):

- `services`
- `transactionlogs`
- `transactions`
- `usercustomroles`
- `users`
- `vouchers`
- `voucherusages`
- `wishlists`

### ❌ Collections còn thiếu (17):

- `properties` - Tài sản (homestay, villa, etc.)
- `listings` - Phòng/Listing
- `bookings` - Đặt phòng
- `reviews` - Đánh giá
- `amenities` - Tiện ích
- `messages` - Tin nhắn
- `notifications` - Thông báo
- `houserules` - Nội quy
- `safetyfeatures` - Tính năng an toàn
- `propertystaffassignments` - Phân công nhân viên
- `custom-role-permission` - Phân quyền tùy chỉnh
- `custom-role` - Vai trò tùy chỉnh
- `permission` - Quyền hạn
- `refresh-token` - Token làm mới
- `chatbot-message` - Tin nhắn chatbot
- `dashboard` - Dashboard
- `transaction-log` - Log giao dịch

---

## Property

| No. | Name         | Type          | Ghi chú                                                       |
| --- | ------------ | ------------- | ------------------------------------------------------------- |
| 1   | \_id         | ObjectId      | Mã số tự tăng, duy nhất cho mỗi bản ghi                       |
| 2   | name         | String        | Tên tài sản (homestay, villa, etc.)                           |
| 3   | type         | String (Enum) | Loại tài sản: 'apartment','mini_apartment','homestay','villa' |
| 4   | description  | String        | Mô tả chi tiết tài sản                                        |
| 5   | thumbnail    | String        | Ảnh đại diện tài sản                                          |
| 6   | images       | Array         | Danh sách ảnh tài sản                                         |
| 7   | location     | Object        | Thông tin địa chỉ và tọa độ                                   |
| 8   | checkInTime  | String        | Giờ check-in (VD: 14:00)                                      |
| 9   | checkOutTime | String        | Giờ check-out (VD: 12:00)                                     |
| 10  | contactPhone | String        | Số điện thoại liên hệ                                         |
| 11  | contactEmail | String        | Email liên hệ                                                 |
| 12  | status       | String (Enum) | Trạng thái tài sản: 'active','inactive','pending'             |
| 13  | isVerified   | Boolean       | Đã được xác minh bởi admin                                    |
| 14  | isDeleted    | Boolean       | Đánh dấu xóa mềm                                              |
| 15  | deletedAt    | Date          | Thời điểm xóa                                                 |
| 16  | allowPets    | Boolean       | Cho phép thú cưng                                             |
| 17  | createdBy    | ObjectId      | ID người tạo                                                  |
| 18  | updatedBy    | ObjectId      | ID người cập nhật                                             |
| 19  | deletedBy    | ObjectId      | ID người xóa                                                  |
| 20  | createdAt    | Date          | Thời điểm tạo                                                 |
| 21  | updatedAt    | Date          | Thời điểm cập nhật                                            |

## Listing

| No. | Name                      | Type          | Ghi chú                                        |
| --- | ------------------------- | ------------- | ---------------------------------------------- |
| 1   | \_id                      | ObjectId      | Mã số tự tăng, duy nhất cho mỗi bản ghi        |
| 2   | propertyId                | ObjectId      | ID tài sản                                     |
| 3   | title                     | String        | Tiêu đề phòng                                  |
| 4   | description               | String        | Mô tả chi tiết phòng                           |
| 5   | images                    | Array         | Danh sách ảnh phòng                            |
| 6   | price_per_night           | Number        | Giá theo đêm                                   |
| 7   | guests                    | Number        | Số khách mặc định                              |
| 8   | max_guests                | Number        | Số khách tối đa                                |
| 9   | allow_infants             | Boolean       | Cho phép trẻ sơ sinh                           |
| 10  | max_infants               | Number        | Số trẻ sơ sinh tối đa                          |
| 11  | beds                      | Number        | Số giường                                      |
| 12  | bathrooms                 | Number        | Số phòng tắm                                   |
| 13  | amenities                 | Array         | Danh sách tiện ích                             |
| 14  | house_rules_selected      | Array         | Danh sách nội quy                              |
| 15  | safety_features           | Array         | Danh sách tính năng an toàn                    |
| 16  | service_ids               | Array         | Danh sách dịch vụ                              |
| 17  | voucher_ids               | Array         | Danh sách voucher                              |
| 18  | other_rules               | Object        | Nội quy khác                                   |
| 19  | cancel_policy             | String (Enum) | Chính sách hủy: 'flexible','moderate','strict' |
| 20  | allow_pets                | Boolean       | Cho phép thú cưng                              |
| 21  | is_verified               | Boolean       | Đã xác minh                                    |
| 22  | status                    | String (Enum) | Trạng thái phòng: 'draft','active','inactive'  |
| 23  | isDeleted                 | Boolean       | Đánh dấu xóa mềm                               |
| 24  | average_rating            | Number        | Điểm đánh giá trung bình                       |
| 25  | reviews_count             | Number        | Số lượng đánh giá                              |
| 26  | viewCount                 | Number        | Số lượt xem                                    |
| 27  | has_weekend_surcharge     | Boolean       | Có phụ phí cuối tuần                           |
| 28  | weekend_surcharge_percent | Number        | Phần trăm phụ phí cuối tuần                    |
| 29  | createdAt                 | Date          | Thời điểm tạo                                  |
| 30  | updatedAt                 | Date          | Thời điểm cập nhật                             |

## Booking

| No. | Name                         | Type          | Ghi chú                                                             |
| --- | ---------------------------- | ------------- | ------------------------------------------------------------------- |
| 1   | \_id                         | ObjectId      | Mã số tự tăng, duy nhất cho mỗi bản ghi                             |
| 2   | propertyId                   | ObjectId      | ID tài sản                                                          |
| 3   | listingId                    | ObjectId      | ID phòng                                                            |
| 4   | guestId                      | ObjectId      | ID khách hàng                                                       |
| 5   | checkInDate                  | Date          | Ngày check-in                                                       |
| 6   | check_out_date               | Date          | Ngày check-out                                                      |
| 7   | guests                       | Number        | Số khách                                                            |
| 8   | infants                      | Number        | Số trẻ sơ sinh                                                      |
| 9   | nights                       | Number        | Số đêm                                                              |
| 10  | price_per_night              | Number        | Giá theo đêm                                                        |
| 11  | total_price                  | Number        | Tổng tiền phòng                                                     |
| 12  | service_fee                  | Number        | Phí dịch vụ                                                         |
| 13  | tax_amount                   | Number        | Thuế                                                                |
| 14  | final_amount                 | Number        | Tổng tiền cuối cùng                                                 |
| 15  | commissionRate               | Number        | Tỷ lệ hoa hồng                                                      |
| 16  | finalPayoutAmount            | Number        | Số tiền thanh toán cho chủ                                          |
| 17  | status                       | String (Enum) | Trạng thái đặt phòng: 'pending','confirmed','cancelled','completed' |
| 18  | payment_status               | String (Enum) | Trạng thái thanh toán: 'unpaid','paid','refunded'                   |
| 19  | payment_method               | String        | Phương thức thanh toán                                              |
| 20  | guest_name                   | String        | Tên khách hàng                                                      |
| 21  | guest_email                  | String        | Email khách hàng                                                    |
| 22  | note                         | String        | Ghi chú đặt phòng                                                   |
| 23  | additionalCost               | Number        | Chi phí phát sinh                                                   |
| 24  | additionalCostReason         | String        | Lý do chi phí phát sinh                                             |
| 25  | cancellationDetails          | Object        | Chi tiết hủy phòng                                                  |
| 26  | deposit_percent              | Number        | Phần trăm đặt cọc                                                   |
| 27  | deposit_amount               | Number        | Số tiền đặt cọc                                                     |
| 28  | deposit_paid                 | Boolean       | Đã thanh toán đặt cọc                                               |
| 29  | deposit_paid_amount          | Number        | Số tiền đã thanh toán đặt cọc                                       |
| 30  | refund_amount                | Number        | Số tiền hoàn lại                                                    |
| 31  | cancellationDetailsUpdatedAt | Date          | Thời điểm cập nhật chi tiết hủy                                     |
| 32  | cancellationDetailsUpdatedBy | ObjectId      | ID người cập nhật chi tiết hủy                                      |
| 33  | isDeleted                    | Boolean       | Đánh dấu xóa mềm                                                    |
| 34  | createdBy                    | ObjectId      | ID người tạo                                                        |
| 35  | updatedBy                    | ObjectId      | ID người cập nhật                                                   |
| 36  | deletedBy                    | ObjectId      | ID người xóa                                                        |
| 37  | created_at                   | Date          | Thời điểm tạo                                                       |
| 38  | updated_at                   | Date          | Thời điểm cập nhật                                                  |
| 39  | deletedAt                    | Date          | Thời điểm xóa                                                       |

## User

| No. | Name          | Type          | Ghi chú                                     |
| --- | ------------- | ------------- | ------------------------------------------- |
| 1   | \_id          | ObjectId      | Mã số tự tăng, duy nhất cho mỗi bản ghi     |
| 2   | name          | String        | Tên người dùng                              |
| 3   | email         | String        | Email đăng nhập                             |
| 4   | password_hash | String        | Mật khẩu đã mã hóa                          |
| 5   | phone         | String        | Số điện thoại                               |
| 6   | avatar_url    | String        | Ảnh đại diện                                |
| 7   | role          | String (Enum) | Vai trò người dùng: 'guest','staff','admin' |
| 8   | customRoles   | Array         | Vai trò tùy chỉnh                           |
| 9   | language      | String        | Ngôn ngữ                                    |
| 10  | is_verified   | Boolean       | Đã xác minh email                           |
| 11  | isDeleted     | Boolean       | Đánh dấu xóa mềm                            |
| 12  | deletedAt     | Date          | Thời điểm xóa                               |
| 13  | createdAt     | Date          | Thời điểm tạo                               |
| 14  | updatedAt     | Date          | Thời điểm cập nhật                          |

## Service

| No. | Name          | Type     | Ghi chú                                 |
| --- | ------------- | -------- | --------------------------------------- |
| 1   | \_id          | ObjectId | Mã số tự tăng, duy nhất cho mỗi bản ghi |
| 2   | name          | String   | Tên dịch vụ                             |
| 3   | description   | String   | Mô tả dịch vụ                           |
| 4   | icon_url      | String   | Icon dịch vụ                            |
| 5   | unit          | String   | Đơn vị tính (VD: /ngày)                 |
| 6   | default_price | Number   | Giá mặc định                            |
| 7   | is_active     | Boolean  | Trạng thái hoạt động                    |
| 8   | isDeleted     | Boolean  | Đánh dấu xóa mềm                        |
| 9   | createdBy     | ObjectId | ID người tạo                            |
| 10  | updatedBy     | ObjectId | ID người cập nhật                       |
| 11  | deletedBy     | ObjectId | ID người xóa                            |
| 12  | deletedAt     | Date     | Thời điểm xóa                           |
| 13  | created_at    | Date     | Thời điểm tạo                           |
| 14  | updated_at    | Date     | Thời điểm cập nhật                      |

## Amenity

| No. | Name            | Type     | Ghi chú                                 |
| --- | --------------- | -------- | --------------------------------------- |
| 1   | \_id            | ObjectId | Mã số tự tăng, duy nhất cho mỗi bản ghi |
| 2   | name            | String   | Tên tiện ích                            |
| 3   | description     | String   | Mô tả tiện ích                          |
| 4   | icon_url        | String   | Icon tiện ích                           |
| 5   | default_checked | Boolean  | Mặc định được chọn                      |
| 6   | is_active       | Boolean  | Trạng thái hoạt động                    |
| 7   | isDeleted       | Boolean  | Đánh dấu xóa mềm                        |
| 8   | createdBy       | ObjectId | ID người tạo                            |
| 9   | updatedBy       | ObjectId | ID người cập nhật                       |
| 10  | deletedBy       | ObjectId | ID người xóa                            |
| 11  | deletedAt       | Date     | Thời điểm xóa                           |
| 12  | created_at      | Date     | Thời điểm tạo                           |
| 13  | updated_at      | Date     | Thời điểm cập nhật                      |

## HouseRule

| No. | Name            | Type     | Ghi chú                                 |
| --- | --------------- | -------- | --------------------------------------- |
| 1   | \_id            | ObjectId | Mã số tự tăng, duy nhất cho mỗi bản ghi |
| 2   | name            | String   | Tên nội quy                             |
| 3   | description     | String   | Mô tả nội quy                           |
| 4   | icon_url        | String   | Icon nội quy                            |
| 5   | default_checked | Boolean  | Mặc định được chọn                      |
| 6   | is_active       | Boolean  | Trạng thái hoạt động                    |
| 7   | isDeleted       | Boolean  | Đánh dấu xóa mềm                        |
| 8   | createdBy       | ObjectId | ID người tạo                            |
| 9   | updatedBy       | ObjectId | ID người cập nhật                       |
| 10  | deletedBy       | ObjectId | ID người xóa                            |
| 11  | deletedAt       | Date     | Thời điểm xóa                           |
| 12  | created_at      | Date     | Thời điểm tạo                           |
| 13  | updated_at      | Date     | Thời điểm cập nhật                      |

## SafetyFeature

| No. | Name            | Type     | Ghi chú                                 |
| --- | --------------- | -------- | --------------------------------------- |
| 1   | \_id            | ObjectId | Mã số tự tăng, duy nhất cho mỗi bản ghi |
| 2   | name            | String   | Tên tính năng an toàn                   |
| 3   | description     | String   | Mô tả tính năng                         |
| 4   | is_active       | Boolean  | Trạng thái hoạt động                    |
| 5   | default_checked | Boolean  | Mặc định được chọn                      |
| 6   | isDeleted       | Boolean  | Đánh dấu xóa mềm                        |
| 7   | createdBy       | ObjectId | ID người tạo                            |
| 8   | updatedBy       | ObjectId | ID người cập nhật                       |
| 9   | deletedBy       | ObjectId | ID người xóa                            |
| 10  | deletedAt       | Date     | Thời điểm xóa                           |
| 11  | created_at      | Date     | Thời điểm tạo                           |
| 12  | updated_at      | Date     | Thời điểm cập nhật                      |

## Voucher

| No. | Name              | Type     | Ghi chú                                 |
| --- | ----------------- | -------- | --------------------------------------- |
| 1   | \_id              | ObjectId | Mã số tự tăng, duy nhất cho mỗi bản ghi |
| 2   | code              | String   | Mã voucher (unique)                     |
| 3   | discount_percent  | Number   | Phần trăm giảm giá (0-50)               |
| 4   | max_uses          | Number   | Số lần sử dụng tối đa                   |
| 5   | uses_count        | Number   | Số lần đã sử dụng                       |
| 6   | max_uses_per_user | Number   | Số lần sử dụng tối đa mỗi user          |
| 7   | expiration_date   | Date     | Ngày hết hạn                            |
| 8   | is_active         | Boolean  | Trạng thái hoạt động                    |
| 9   | description       | String   | Mô tả voucher                           |
| 10  | min_order_value   | Number   | Giá trị đơn hàng tối thiểu              |
| 11  | applies_to        | Object   | Áp dụng cho property/room nào           |
| 12  | isDeleted         | Boolean  | Đánh dấu xóa mềm                        |
| 13  | createdBy         | ObjectId | ID người tạo                            |
| 14  | updatedBy         | ObjectId | ID người cập nhật                       |
| 15  | deletedBy         | ObjectId | ID người xóa                            |
| 16  | created_at        | Date     | Thời điểm tạo                           |
| 17  | updated_at        | Date     | Thời điểm cập nhật                      |
| 18  | deletedAt         | Date     | Thời điểm xóa                           |

## Review

| No. | Name        | Type     | Ghi chú                                 |
| --- | ----------- | -------- | --------------------------------------- |
| 1   | \_id        | ObjectId | Mã số tự tăng, duy nhất cho mỗi bản ghi |
| 2   | user_id     | ObjectId | ID người đánh giá                       |
| 3   | property_id | ObjectId | ID tài sản                              |
| 4   | room_id     | ObjectId | ID phòng                                |
| 5   | rating      | Number   | Điểm đánh giá (1-5)                     |
| 6   | comment     | String   | Nội dung đánh giá                       |
| 7   | created_at  | Date     | Thời điểm tạo                           |
| 8   | updated_at  | Date     | Thời điểm cập nhật                      |

## Transaction

| No. | Name                    | Type          | Ghi chú                                                                            |
| --- | ----------------------- | ------------- | ---------------------------------------------------------------------------------- |
| 1   | \_id                    | ObjectId      | Mã số tự tăng, duy nhất cho mỗi bản ghi                                            |
| 2   | type                    | String (Enum) | Loại giao dịch: 'payment','payout','refund'                                        |
| 3   | propertyId              | ObjectId      | ID tài sản                                                                         |
| 4   | reference_id            | ObjectId      | ID tham chiếu (booking, etc.)                                                      |
| 5   | reference_type          | String (Enum) | Loại tham chiếu: 'booking','manual','refund_request','payout_request','commission' |
| 6   | user_id                 | ObjectId      | ID người dùng                                                                      |
| 7   | direction               | String (Enum) | Hướng giao dịch: 'in','out','refund'                                               |
| 8   | amount                  | Number        | Số tiền                                                                            |
| 9   | currency                | String        | Loại tiền tệ                                                                       |
| 10  | status                  | String (Enum) | Trạng thái giao dịch: 'pending','processing','success','failed','reversed'         |
| 11  | method                  | String (Enum) | Phương thức thanh toán: 'momo','vnpay','wallet','bank_transfer','paypal','cash'    |
| 12  | note                    | String        | Ghi chú                                                                            |
| 13  | provider                | String (Enum) | Nhà cung cấp thanh toán: 'momo','vnpay','paypal','internal'                        |
| 14  | provider_transaction_id | String        | ID giao dịch từ provider                                                           |
| 15  | provider_order_id       | String        | ID đơn hàng từ provider                                                            |
| 16  | raw_response            | Object        | Response thô từ provider                                                           |
| 17  | created_by              | ObjectId      | ID người tạo                                                                       |
| 18  | updated_by              | ObjectId      | ID người cập nhật                                                                  |
| 19  | deletedBy               | ObjectId      | ID người xóa                                                                       |
| 20  | isDeleted               | Boolean       | Đánh dấu xóa mềm                                                                   |
| 21  | deletedAt               | Date          | Thời điểm xóa                                                                      |
| 22  | createdAt               | Date          | Thời điểm tạo                                                                      |
| 23  | updatedAt               | Date          | Thời điểm cập nhật                                                                 |

## Message

| No. | Name                | Type          | Ghi chú                                   |
| --- | ------------------- | ------------- | ----------------------------------------- |
| 1   | \_id                | ObjectId      | Mã số tự tăng, duy nhất cho mỗi bản ghi   |
| 2   | sender_id           | ObjectId      | ID người gửi                              |
| 3   | receiver_id         | ObjectId      | ID người nhận                             |
| 4   | property_id         | ObjectId      | ID tài sản (nếu có)                       |
| 5   | content             | String        | Nội dung tin nhắn                         |
| 6   | sent_at             | Date          | Thời điểm gửi                             |
| 7   | is_read             | String (Enum) | Trạng thái đọc: 'sent','delivered','read' |
| 8   | reactions           | Object        | Reactions (like, heart, etc.)             |
| 9   | is_recalled         | Boolean       | Đã thu hồi                                |
| 10  | recalled_at         | Date          | Thời điểm thu hồi                         |
| 11  | reply_to_message_id | ObjectId      | ID tin nhắn trả lời                       |
| 12  | createdAt           | Date          | Thời điểm tạo                             |
| 13  | updatedAt           | Date          | Thời điểm cập nhật                        |

## Wishlist

| No. | Name        | Type     | Ghi chú                                 |
| --- | ----------- | -------- | --------------------------------------- |
| 1   | \_id        | ObjectId | Mã số tự tăng, duy nhất cho mỗi bản ghi |
| 2   | user_id     | ObjectId | ID người dùng                           |
| 3   | property_id | ObjectId | ID tài sản                              |
| 4   | room_id     | ObjectId | ID phòng                                |
| 5   | isDelete    | Boolean  | Đánh dấu xóa mềm                        |
| 6   | created_at  | Date     | Thời điểm tạo                           |
| 7   | updated_at  | Date     | Thời điểm cập nhật                      |

## Notification

| No. | Name           | Type          | Ghi chú                                                  |
| --- | -------------- | ------------- | -------------------------------------------------------- |
| 1   | \_id           | ObjectId      | Mã số tự tăng, duy nhất cho mỗi bản ghi                  |
| 2   | user_id        | ObjectId      | ID người nhận                                            |
| 3   | recipient_type | String (Enum) | Loại người nhận: 'user','staff','admin'                  |
| 4   | title          | String        | Tiêu đề thông báo                                        |
| 5   | message        | String        | Nội dung thông báo                                       |
| 6   | type           | String (Enum) | Loại thông báo: 'booking','payment','system','promotion' |
| 7   | sent_method    | String (Enum) | Phương thức gửi: 'in_app','email','sms'                  |
| 8   | status         | String (Enum) | Trạng thái gửi: 'pending','sent','failed'                |
| 9   | is_read        | Boolean       | Đã đọc                                                   |
| 10  | sent_at        | Date          | Thời điểm gửi                                            |
| 11  | isDeleted      | Boolean       | Đánh dấu xóa mềm                                         |
| 12  | createdAt      | Date          | Thời điểm tạo                                            |
| 13  | updatedAt      | Date          | Thời điểm cập nhật                                       |

## PropertyStaffAssignment

| No. | Name       | Type          | Ghi chú                                   |
| --- | ---------- | ------------- | ----------------------------------------- |
| 1   | \_id       | ObjectId      | Mã số tự tăng, duy nhất cho mỗi bản ghi   |
| 2   | propertyId | ObjectId      | ID tài sản                                |
| 3   | staffId    | ObjectId      | ID nhân viên                              |
| 4   | assignedBy | ObjectId      | ID người phân công                        |
| 5   | status     | String (Enum) | Trạng thái phân công: 'active','inactive' |
| 6   | assignedAt | Date          | Thời điểm phân công                       |
| 7   | createdAt  | Date          | Thời điểm tạo                             |
| 8   | updatedAt  | Date          | Thời điểm cập nhật                        |

## CustomRole

| No. | Name        | Type     | Ghi chú                                 |
| --- | ----------- | -------- | --------------------------------------- |
| 1   | \_id        | ObjectId | Mã số tự tăng, duy nhất cho mỗi bản ghi |
| 2   | name        | String   | Tên vai trò tùy chỉnh                   |
| 3   | description | String   | Mô tả vai trò                           |
| 4   | permissions | Array    | Danh sách quyền hạn                     |
| 5   | is_active   | Boolean  | Trạng thái hoạt động                    |
| 6   | createdBy   | ObjectId | ID người tạo                            |
| 7   | createdAt   | Date     | Thời điểm tạo                           |
| 8   | updatedAt   | Date     | Thời điểm cập nhật                      |

## Permission

| No. | Name        | Type     | Ghi chú                                  |
| --- | ----------- | -------- | ---------------------------------------- |
| 1   | \_id        | ObjectId | Mã số tự tăng, duy nhất cho mỗi bản ghi  |
| 2   | name        | String   | Tên quyền hạn                            |
| 3   | description | String   | Mô tả quyền hạn                          |
| 4   | resource    | String   | Tài nguyên (booking, property, etc.)     |
| 5   | action      | String   | Hành động (create, read, update, delete) |
| 6   | is_active   | Boolean  | Trạng thái hoạt động                     |
| 7   | createdAt   | Date     | Thời điểm tạo                            |
| 8   | updatedAt   | Date     | Thời điểm cập nhật                       |

## CustomRolePermission

| No. | Name          | Type     | Ghi chú                                 |
| --- | ------------- | -------- | --------------------------------------- |
| 1   | \_id          | ObjectId | Mã số tự tăng, duy nhất cho mỗi bản ghi |
| 2   | role_id       | ObjectId | ID vai trò                              |
| 3   | permission_id | ObjectId | ID quyền hạn                            |
| 4   | createdAt     | Date     | Thời điểm tạo                           |
| 5   | updatedAt     | Date     | Thời điểm cập nhật                      |

## UserCustomRole

| No. | Name        | Type     | Ghi chú                                 |
| --- | ----------- | -------- | --------------------------------------- |
| 1   | \_id        | ObjectId | Mã số tự tăng, duy nhất cho mỗi bản ghi |
| 2   | user_id     | ObjectId | ID người dùng                           |
| 3   | role_id     | ObjectId | ID vai trò tùy chỉnh                    |
| 4   | assigned_by | ObjectId | ID người phân quyền                     |
| 5   | is_active   | Boolean  | Trạng thái hoạt động                    |
| 6   | createdAt   | Date     | Thời điểm tạo                           |
| 7   | updatedAt   | Date     | Thời điểm cập nhật                      |

## RefreshToken

| No. | Name       | Type     | Ghi chú                                 |
| --- | ---------- | -------- | --------------------------------------- |
| 1   | \_id       | ObjectId | Mã số tự tăng, duy nhất cho mỗi bản ghi |
| 2   | user_id    | ObjectId | ID người dùng                           |
| 3   | token      | String   | Refresh token                           |
| 4   | expires_at | Date     | Thời điểm hết hạn                       |
| 5   | is_revoked | Boolean  | Đã thu hồi                              |
| 6   | createdAt  | Date     | Thời điểm tạo                           |
| 7   | updatedAt  | Date     | Thời điểm cập nhật                      |

## ChatbotMessage

| No. | Name       | Type     | Ghi chú                                 |
| --- | ---------- | -------- | --------------------------------------- |
| 1   | \_id       | ObjectId | Mã số tự tăng, duy nhất cho mỗi bản ghi |
| 2   | user_id    | ObjectId | ID người dùng                           |
| 3   | message    | String   | Nội dung tin nhắn                       |
| 4   | response   | String   | Phản hồi từ chatbot                     |
| 5   | session_id | String   | ID phiên chat                           |
| 6   | createdAt  | Date     | Thời điểm tạo                           |
| 7   | updatedAt  | Date     | Thời điểm cập nhật                      |

## Dashboard

| No. | Name      | Type     | Ghi chú                                 |
| --- | --------- | -------- | --------------------------------------- |
| 1   | \_id      | ObjectId | Mã số tự tăng, duy nhất cho mỗi bản ghi |
| 2   | user_id   | ObjectId | ID người dùng                           |
| 3   | widgets   | Object   | Cấu hình widgets                        |
| 4   | layout    | Object   | Layout dashboard                        |
| 5   | createdAt | Date     | Thời điểm tạo                           |
| 6   | updatedAt | Date     | Thời điểm cập nhật                      |

## TransactionLog

| No. | Name           | Type     | Ghi chú                                 |
| --- | -------------- | -------- | --------------------------------------- |
| 1   | \_id           | ObjectId | Mã số tự tăng, duy nhất cho mỗi bản ghi |
| 2   | transaction_id | ObjectId | ID giao dịch                            |
| 3   | action         | String   | Hành động (created, updated, etc.)      |
| 4   | old_values     | Object   | Giá trị cũ                              |
| 5   | new_values     | Object   | Giá trị mới                             |
| 6   | changed_by     | ObjectId | ID người thay đổi                       |
| 7   | createdAt      | Date     | Thời điểm tạo                           |

## VoucherUsage

| No. | Name            | Type     | Ghi chú                                 |
| --- | --------------- | -------- | --------------------------------------- |
| 1   | \_id            | ObjectId | Mã số tự tăng, duy nhất cho mỗi bản ghi |
| 2   | voucher_id      | ObjectId | ID voucher                              |
| 3   | user_id         | ObjectId | ID người dùng                           |
| 4   | booking_id      | ObjectId | ID booking                              |
| 5   | discount_amount | Number   | Số tiền giảm giá                        |
| 6   | order_amount    | Number   | Tổng tiền đơn hàng                      |
| 7   | used_at         | Date     | Thời điểm sử dụng                       |
| 8   | createdBy       | ObjectId | ID người tạo                            |
| 9   | created_at      | Date     | Thời điểm tạo                           |
| 10  | updated_at      | Date     | Thời điểm cập nhật                      |
| 11  | deletedBy       | ObjectId | ID người xóa                            |
| 12  | deleted_at      | Date     | Thời điểm xóa                           |
| 13  | isDeleted       | Boolean  | Đánh dấu xóa mềm                        |
