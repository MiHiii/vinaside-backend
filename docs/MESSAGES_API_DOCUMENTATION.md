# Messages API Documentation

## Tổng quan

Messages API cung cấp hệ thống chat hoàn chỉnh với kiến trúc **conversation-based**, hỗ trợ:

- Chat giữa guest và staff của property
- Real-time messaging qua WebSocket
- Reactions với emoji
- Reply messages
- Message recall
- Push notifications
- Unread count tracking

## Base URL

```
https://api.vinaside.com/messages
```

## Authentication

Tất cả API đều yêu cầu JWT token trong header:

```
Authorization: Bearer <jwt_token>
```

## 1. Conversation Management

### 1.1 Lấy danh sách conversations (UI)

**GET** `/messages/conversations`

Lấy danh sách conversations cho UI, được tối ưu cho hiển thị.

#### Query Parameters

- `ui_for` (optional): `'guest' | 'staff'` - Định dạng UI cho role nào

#### Response

```typescript
interface ConversationUI {
  _id: string; // Conversation ID
  thread_type: 'property'; // Luôn là 'property'
  property: {
    _id: string;
    name: string;
    thumbnail?: string;
    status: string;
    isVerified: boolean;
  } | null;
  guest: {
    _id: string;
    name: string;
    avatar_url?: string;
  } | null;
  staff_summary: {
    count: number; // Số staff được assign
    last_active: {
      _id: string;
      name: string;
      avatar_url?: string;
    } | null;
  };
  lastMessage: {
    _id: string;
    content: string;
    sender_id: string;
    sender_role: 'guest' | 'staff' | 'admin';
    sent_at: Date;
    is_read: MessageStatus;
  } | null;
  lastMessageAt: Date | null;
  messageCount: number;
  ui_for: 'guest' | 'staff';
  display: {
    title: string; // Tên hiển thị
    subtitle: string; // Preview tin nhắn cuối
    avatar_url: string | null; // Avatar
    badge: null | {
      text: string;
      avatar_url: string | null;
    };
    unreadCount: number;
  };
}
```

#### Ví dụ Response

```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "thread_type": "property",
    "property": {
      "_id": "507f1f77bcf86cd799439012",
      "name": "Căn hộ Sunshine",
      "thumbnail": "https://example.com/thumb.jpg",
      "status": "active",
      "isVerified": true
    },
    "guest": {
      "_id": "507f1f77bcf86cd799439013",
      "name": "Nguyễn Văn A",
      "avatar_url": "https://example.com/avatar.jpg"
    },
    "staff_summary": {
      "count": 2,
      "last_active": {
        "_id": "507f1f77bcf86cd799439014",
        "name": "Nhân viên B",
        "avatar_url": "https://example.com/staff.jpg"
      }
    },
    "lastMessage": {
      "_id": "507f1f77bcf86cd799439015",
      "content": "Xin chào, tôi muốn hỏi về căn hộ",
      "sender_id": "507f1f77bcf86cd799439013",
      "sender_role": "guest",
      "sent_at": "2024-01-15T10:30:00Z",
      "is_read": "sent"
    },
    "lastMessageAt": "2024-01-15T10:30:00Z",
    "messageCount": 5,
    "ui_for": "staff",
    "display": {
      "title": "Nguyễn Văn A",
      "subtitle": "Người gửi cuối: Xin chào, tôi muốn hỏi về căn hộ",
      "avatar_url": "https://example.com/avatar.jpg",
      "badge": {
        "text": "Căn hộ Sunshine",
        "avatar_url": "https://example.com/thumb.jpg"
      },
      "unreadCount": 2
    }
  }
]
```

### 1.2 Lấy tin nhắn trong conversation

**GET** `/messages/conversation`

#### Query Parameters

- `conversationId` (required): ID của conversation
- `limit` (optional): Số tin nhắn tối đa (default: tất cả)
- `page` (optional): Trang (default: 1)
- `ui_for` (optional): `'guest' | 'staff'` - Định dạng UI

#### Response

```typescript
interface MessageWithUI {
  _id: string;
  conversation_id: string;
  property_id: string;
  guest_id: string;
  sender_id: string;
  content: string;
  sent_at: Date;
  is_read: MessageStatus;
  is_recalled?: boolean;
  recalled_at?: Date;
  reactions: Array<{
    userId: string;
    username: string;
    avatar_url?: string;
    type: ReactionType;
    emoji: string;
    created_at: string;
  }>;
  reply_to?: {
    message_id: string;
    content: string;
    sender_id: string;
    sender_name: string;
    sent_at: Date;
  } | null;
  ui_for: 'guest' | 'staff';
  ui: {
    mine: boolean; // Tin nhắn của mình
    show_sender_meta: boolean; // Có hiển thị thông tin sender
    sender_display_name: string;
    sender_avatar_url: string | null;
  };
}
```

### 1.3 Đánh dấu conversation đã đọc

**PATCH** `/messages/conversation/read`

#### Query Parameters

- `conversationId` (required): ID của conversation

#### Response

```json
{
  "ok": true
}
```

## 2. Gửi tin nhắn

### 2.1 Tạo tin nhắn mới

**POST** `/messages`

#### Request Body

```typescript
interface CreateMessageDto {
  conversation_id?: string; // Nếu có conversation sẵn
  property_id?: string; // ID property (nếu tạo conversation mới)
  guest_id?: string; // ID guest (nếu staff tạo)
  content: string; // Nội dung tin nhắn
  reply_to_message_id?: string; // ID tin nhắn reply (optional)
}
```

#### Cách sử dụng:

1. **Trong conversation có sẵn**: Chỉ cần `conversation_id` + `content`
2. **Tạo conversation mới**:
   - Guest: `property_id` + `content`
   - Staff: `property_id` + `guest_id` + `content`

#### Response

```typescript
interface MessageResponse {
  _id: string;
  conversation_id: string;
  property_id: string;
  guest_id: string;
  sender_id: string;
  content: string;
  sent_at: Date;
  is_read: MessageStatus;
  reactions: Array<ReactionResponse>;
  reply_to?: ReplyToMessage | null;
  // ... các field khác
}
```

## 3. Reactions

### 3.1 Thêm reaction

**POST** `/messages/:messageId/reactions`

#### Request Body

```typescript
interface AddReactionDto {
  type: ReactionType; // 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry'
}
```

### 3.2 Xóa reaction

**DELETE** `/messages/:messageId/reactions/:type`

### 3.3 Toggle reaction

**POST** `/messages/:messageId/reactions/toggle/:type`

#### Response

```typescript
interface ToggleReactionResponse {
  action: 'added' | 'removed';
  message: MessageResponse;
}
```

## 4. Message Actions

### 4.1 Thu hồi tin nhắn

**POST** `/messages/:messageId/recall`

Chỉ sender mới có thể thu hồi tin nhắn của mình.

### 4.2 Cập nhật tin nhắn

**PATCH** `/messages/:messageId`

#### Request Body

```typescript
interface UpdateMessageDto {
  content: string;
}
```

### 4.3 Xóa tin nhắn

**DELETE** `/messages/:messageId`

## 5. Real-time Events (WebSocket)

### 5.1 Kết nối WebSocket

```javascript
const socket = io('https://api.vinaside.com', {
  auth: {
    token: 'your_jwt_token',
  },
});
```

### 5.2 Events nhận được

#### Tin nhắn mới

```javascript
socket.on('new_message', (message) => {
  // message: MessageResponse
  console.log('Tin nhắn mới:', message);
});
```

#### Cập nhật reaction

```javascript
socket.on('reaction_update', (message) => {
  // message: MessageResponse với reactions đã cập nhật
  console.log('Reaction updated:', message);
});
```

#### Tin nhắn bị thu hồi

```javascript
socket.on('message_recalled', (message) => {
  // message: MessageResponse với is_recalled: true
  console.log('Tin nhắn bị thu hồi:', message);
});
```

#### Cập nhật conversation

```javascript
socket.on('conversation_update_v2', (data) => {
  // data: {
  //   conversationId: string;
  //   lastMessage: MessageResponse | null;
  //   lastMessageAt: Date | null;
  //   unreadCount: number;
  // }
  console.log('Conversation updated:', data);
});
```

### 5.3 Events gửi đi

#### Join conversation room

```javascript
socket.emit('join_conversation', { conversationId: 'conversation_id' });
```

#### Leave conversation room

```javascript
socket.emit('leave_conversation', { conversationId: 'conversation_id' });
```

## 6. Push Notifications

Hệ thống tự động gửi push notifications cho:

- Tin nhắn mới (tất cả participants trừ sender)
- Reactions (thông báo cho sender gốc)
- Message recall (thông báo cho tất cả participants trừ người recall)

## 7. Error Handling

### 7.1 Error Codes

- `400 Bad Request`: Dữ liệu không hợp lệ
- `401 Unauthorized`: Token không hợp lệ
- `403 Forbidden`: Không có quyền truy cập
- `404 Not Found`: Không tìm thấy resource
- `500 Internal Server Error`: Lỗi server

### 7.2 Error Response Format

```json
{
  "statusCode": 400,
  "message": "Mô tả lỗi",
  "error": "Bad Request"
}
```

## 8. Best Practices

### 8.1 Performance

- Sử dụng pagination cho conversation messages
- Cache conversation list
- Implement optimistic updates cho reactions

### 8.2 UX

- Hiển thị typing indicator
- Auto-scroll to bottom khi có tin nhắn mới
- Highlight unread messages
- Show message status (sent, delivered, read)

### 8.3 Security

- Validate input data
- Sanitize message content
- Rate limiting cho message sending

## 9. Migration Notes

### 9.1 Từ legacy system

- Các API cũ (`/messages/conversation/:userId`) đã deprecated
- Chuyển sang dùng conversation-based APIs
- Update WebSocket events từ `conversation_update` sang `conversation_update_v2`

### 9.2 Breaking Changes

- `receiver_id` không còn được sử dụng trong conversation-based flow
- Unread count được tính theo `read_at` trong conversation, không phải `receiver_id`

## 10. Examples

### 10.1 Gửi tin nhắn đầu tiên (guest)

```javascript
const response = await fetch('/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    property_id: '507f1f77bcf86cd799439012',
    content: 'Xin chào, tôi muốn hỏi về căn hộ',
  }),
});
```

### 10.2 Reply tin nhắn

```javascript
const response = await fetch('/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    conversation_id: '507f1f77bcf86cd799439011',
    content: 'Cảm ơn bạn đã quan tâm',
    reply_to_message_id: '507f1f77bcf86cd799439015',
  }),
});
```

### 10.3 Thêm reaction

```javascript
const response = await fetch('/messages/507f1f77bcf86cd799439015/reactions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    type: 'like',
  }),
});
```

### 10.4 Lấy conversations với pagination

```javascript
const response = await fetch('/messages/conversations?ui_for=staff', {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
const conversations = await response.json();
```

## 11. TypeScript Types

```typescript
// Enums
enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
}

enum ReactionType {
  LIKE = 'like',
  LOVE = 'love',
  LAUGH = 'laugh',
  WOW = 'wow',
  SAD = 'sad',
  ANGRY = 'angry',
}

// Main interfaces
interface Message {
  _id: string;
  conversation_id: string;
  property_id: string;
  guest_id: string;
  sender_id: string;
  content: string;
  sent_at: Date;
  is_read: MessageStatus;
  is_recalled?: boolean;
  recalled_at?: Date;
  reactions: Reaction[];
  reply_to_message_id?: string;
}

interface Reaction {
  user_id: string;
  type: ReactionType;
  created_at: Date;
}

interface Conversation {
  _id: string;
  property_id: string;
  guest_id: string;
  staff_ids: string[];
  last_message_id?: string;
  last_message_at?: Date;
  last_active_staff_id?: string;
  last_active_staff_at?: Date;
  read_at: Record<string, Date>;
}
```

## 12. Testing

### 12.1 Test endpoints

Sử dụng các file test có sẵn trong thư mục `test/`:

- `booking-listing-status-check.test.http`
- `booking-note-additional-cost.test.http`
- `calendar-management.test.http`

### 12.2 WebSocket testing

```javascript
// Test WebSocket connection
const socket = io('http://localhost:3000');
socket.on('connect', () => {
  console.log('Connected to WebSocket');
});
```

---

**Lưu ý**: API này đã được tối ưu cho kiến trúc conversation-based và hỗ trợ real-time messaging. Vui lòng sử dụng các endpoint mới thay vì các API legacy đã deprecated.

