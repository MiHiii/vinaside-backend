# 🏠 Property Messages Integration Guide

## 📋 Tổng quan

Module này cho phép **Guest** nhắn tin trực tiếp với **Staff** quản lý property thông qua hệ thống phân quyền `property-staff-assignment`.

## 🎯 Tính năng chính

### 1. **Guest → Staff Communication**

- Guest có thể gửi tin nhắn cho staff quản lý property
- Tin nhắn tự động được gửi đến staff được assign cho property đó
- Hỗ trợ reply tin nhắn

### 2. **Property-based Message Management**

- Tin nhắn được liên kết với property cụ thể
- Guest chỉ xem được tin nhắn của mình với property
- Staff/Admin xem được tất cả tin nhắn của property

### 3. **Real-time Communication**

- WebSocket support cho tin nhắn real-time
- Notifications cho tin nhắn mới
- Online/offline status

## 🚀 API Endpoints

### **1. Gửi tin nhắn cho staff quản lý property**

```http
POST /messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "receiver_id": "staff_id",
  "property_id": "property_id_here",
  "content": "Xin chào, tôi muốn hỏi về phòng này",
  "reply_to_message_id": "optional_reply_message_id"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Gửi tin nhắn cho staff quản lý property thành công",
  "data": {
    "_id": "message_id",
    "sender_id": {
      "_id": "guest_id",
      "name": "Guest Name",
      "email": "guest@example.com"
    },
    "receiver_id": {
      "_id": "staff_id",
      "name": "Staff Name",
      "email": "staff@example.com"
    },
    "property_id": {
      "_id": "property_id",
      "name": "Property Name",
      "address": "Property Address"
    },
    "content": "Xin chào, tôi muốn hỏi về phòng này",
    "sent_at": "2024-01-01T00:00:00.000Z",
    "is_read": "sent"
  }
}
```

### **2. Lấy tin nhắn của property**

```http
GET /messages?property_id=property_id&page=1&limit=20
Authorization: Bearer <token>
```

**Query Parameters:**

- `property_id` (required): ID của property
- `page` (optional): Trang hiện tại (default: 1)
- `limit` (optional): Số tin nhắn mỗi trang (default: 20)
- `sortBy` (optional): Sắp xếp theo field (default: sent_at)
- `sortOrder` (optional): Thứ tự sắp xếp (default: desc)

**Response:**

```json
{
  "success": true,
  "message": "Lấy tin nhắn của property thành công",
  "data": {
    "messages": [
      {
        "_id": "message_id",
        "sender_id": {
          /* user info */
        },
        "receiver_id": {
          /* user info */
        },
        "property_id": {
          /* property info */
        },
        "content": "Message content",
        "sent_at": "2024-01-01T00:00:00.000Z",
        "is_read": "read"
      }
    ],
    "meta": {
      "total": 50,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    }
  }
}
```

### **3. Lấy danh sách staff quản lý property**

```http
GET /messages/property/{propertyId}/staff
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "message": "Lấy danh sách staff quản lý property thành công",
  "data": [
    {
      "_id": "staff_id",
      "name": "Staff Name",
      "email": "staff@example.com",
      "phone": "0123456789",
      "avatar_url": "https://example.com/avatar.jpg",
      "role": "staff",
      "is_online": true,
      "last_seen": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### **4. Lấy danh sách properties của staff**

```http
GET /messages/staff/{staffId}/properties
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "message": "Lấy danh sách properties của staff thành công",
  "data": [
    {
      "_id": "property_id",
      "name": "Property Name",
      "type": "apartment",
      "address": "Property Address",
      "assignedAt": "2024-01-01T00:00:00.000Z",
      "assignedBy": {
        /* user info */
      }
    }
  ]
}
```

### **5. Kiểm tra staff assignment**

```http
GET /messages/property/{propertyId}/staff/{staffId}/check
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "message": "Kiểm tra assignment thành công",
  "data": {
    "isAssigned": true
  }
}
```

## 🔐 Phân quyền

### **Guest**

- ✅ Gửi tin nhắn cho staff quản lý property
- ✅ Xem tin nhắn của mình với property
- ✅ Xem danh sách staff quản lý property
- ✅ Kiểm tra staff assignment

### **Staff**

- ✅ Nhận tin nhắn từ guest
- ✅ Xem tất cả tin nhắn của property được assign
- ✅ Xem danh sách properties được assign
- ✅ Reply tin nhắn

### **Admin**

- ✅ Tất cả quyền của Staff
- ✅ Xem tất cả tin nhắn của mọi property
- ✅ Quản lý property-staff assignments

## 🔌 WebSocket Events

### **Client Events**

```javascript
// Join property room
socket.emit('join_property_room', { propertyId: 'property_id' });

// Send property message
socket.emit('send_message', {
  receiver_id: 'staff_id',
  property_id: 'property_id',
  content: 'Message content',
});
```

### **Server Events**

```javascript
// Listen for new property messages
socket.on('property_message', (data) => {
  console.log('New property message:', data);
});

// Listen for user online/offline
socket.on('user_online', (data) => {
  console.log('User online:', data.userId);
});

socket.on('user_offline', (data) => {
  console.log('User offline:', data.userId);
});
```

## 📱 Frontend Integration Example

### **React Component Example**

```tsx
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const PropertyChat = ({ propertyId, userId }) => {
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    // Connect to WebSocket
    const newSocket = io('http://localhost:3000/ws/messages', {
      auth: { token: localStorage.getItem('token') },
    });

    // Join property room
    newSocket.emit('join_property_room', { propertyId });

    // Listen for new messages
    newSocket.on('property_message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, [propertyId]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const response = await fetch('/api/messages/property', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          receiver_id: staffId,
          property_id: propertyId,
          content: newMessage,
        }),
      });

      if (response.ok) {
        setNewMessage('');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="property-chat">
      <div className="messages">
        {messages.map((msg) => (
          <div key={msg._id} className="message">
            <strong>{msg.sender_id.name}:</strong> {msg.content}
          </div>
        ))}
      </div>
      <div className="input-area">
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Nhập tin nhắn..."
        />
        <button onClick={sendMessage}>Gửi</button>
      </div>
    </div>
  );
};

export default PropertyChat;
```

## 🗄️ Database Schema

### **Message Schema (Updated)**

```typescript
{
  sender_id: ObjectId,        // User gửi tin nhắn
  receiver_id: ObjectId,      // User nhận tin nhắn
  property_id: ObjectId,      // Property liên quan (NEW)
  content: String,            // Nội dung tin nhắn
  sent_at: Date,              // Thời gian gửi
  is_read: String,            // Trạng thái đọc
  reply_to_message_id: ObjectId, // Tin nhắn reply (optional)
  reactions: Array,           // Reactions
  is_recalled: Boolean,       // Đã thu hồi chưa
  recalled_at: Date,          // Thời gian thu hồi
  createdAt: Date,            // Thời gian tạo
  updatedAt: Date             // Thời gian cập nhật
}
```

### **Indexes**

```javascript
// Property-related indexes
MessageSchema.index({ property_id: 1 });
MessageSchema.index({ property_id: 1, sender_id: 1 });
MessageSchema.index({ property_id: 1, receiver_id: 1 });
MessageSchema.index({ property_id: 1, sent_at: -1 });
```

## 🔄 Workflow

### **1. Guest gửi tin nhắn**

1. Guest gọi API `POST /messages/property`
2. System kiểm tra staff được assign cho property
3. Tạo tin nhắn với `property_id`
4. Gửi notification cho staff qua WebSocket
5. Lưu tin nhắn vào database

### **2. Staff nhận tin nhắn**

1. Staff nhận notification qua WebSocket
2. Staff có thể reply tin nhắn
3. Guest nhận notification reply

### **3. Quản lý tin nhắn**

1. Guest chỉ xem được tin nhắn của mình với property
2. Staff xem được tất cả tin nhắn của property được assign
3. Admin xem được tất cả tin nhắn

## 🚨 Lưu ý quan trọng

1. **Property Staff Assignment**: Đảm bảo staff đã được assign cho property trước khi gửi tin nhắn
2. **Authentication**: Tất cả API đều yêu cầu JWT token
3. **Real-time**: Sử dụng WebSocket cho tin nhắn real-time
4. **Pagination**: API lấy tin nhắn hỗ trợ phân trang
5. **Error Handling**: Xử lý lỗi khi không có staff được assign

## 🎉 Kết luận

Module này cung cấp giải pháp hoàn chỉnh cho việc giao tiếp giữa Guest và Staff quản lý property, với đầy đủ tính năng real-time, phân quyền và quản lý tin nhắn.
