# Hướng dẫn Fix Realtime Messages cho Frontend

## Tổng quan

Để đảm bảo cả 3 role (Guest, Staff, Admin) đều nhận được cập nhật realtime, Frontend cần:

1. **Tham gia đúng WebSocket room** dựa trên role
2. **Lắng nghe tất cả các events** cần thiết
3. **Xử lý events** để cập nhật UI/state
4. **Quản lý lifecycle** của socket listeners

## 🚨 VẤN ĐỀ HIỆN TẠI: Admin/Staff phải load trang mới mới hiện tin nhắn

### Nguyên nhân có thể:

1. **Frontend chưa join `admin_broadcast` room**
2. **Frontend chưa listen event `conversation_list_update`**
3. **Event handlers chưa update state đúng cách**
4. **Socket connection bị disconnect**

### 🔧 DEBUG STEPS CHO ADMIN/STAFF REALTIME

#### **Bước 1: Kiểm tra Socket Connection**

```javascript
// Trong browser console, kiểm tra:
console.log('Socket connected:', socket.connected);
console.log('Socket ID:', socket.id);
console.log('User role:', user.role);
console.log('User ID:', user._id);
```

#### **Bước 2: Kiểm tra Room Joining**

```javascript
// Kiểm tra admin/staff có join admin_broadcast room
console.log('Socket rooms:', Array.from(socket.rooms));

// Nếu không thấy 'admin_broadcast', emit lại:
if (user.role === 'admin' || user.role === 'staff') {
  socket.emit('admin_join_all_rooms', {
    userId: user._id,
    role: user.role,
  });
  console.log('🔍 Re-joining admin_broadcast room');
}
```

#### **Bước 3: Kiểm tra Event Listeners**

```javascript
// Kiểm tra tất cả event listeners đã được đăng ký
console.log('Event names:', socket.eventNames());

// Test listen events
socket.on('conversation_list_update', (data) => {
  console.log('🔍 [TEST] Received conversation_list_update:', data);
  // Cập nhật state ở đây
  setConversations(data.conversations);
});

socket.on('new_message', (data) => {
  console.log('🔍 [TEST] Received new_message:', data);
  // Cập nhật messages ở đây
});

socket.on('conversation_update_v2', (data) => {
  console.log('🔍 [TEST] Received conversation_update_v2:', data);
  // Cập nhật conversation ở đây
});
```

#### **Bước 4: Test API và Realtime**

```javascript
// 1. Gọi API conversations
fetch('/api/messages/conversations?ui_for=admin', {
  headers: { Authorization: `Bearer ${user.token}` },
})
  .then((res) => res.json())
  .then((data) => {
    console.log('🔍 [API] Conversations response:', data);
  });

// 2. Gửi tin nhắn test
fetch('/api/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${user.token}`,
  },
  body: JSON.stringify({
    conversationId: 'your_conversation_id',
    content: 'Test realtime message',
  }),
})
  .then((res) => res.json())
  .then((data) => {
    console.log('🔍 [API] Send message response:', data);
  });
```

#### **Bước 5: Kiểm tra Backend Logs**

Trong backend console, tìm các log sau:

```
🔍 [Conversations API] Emitted realtime update for admin/staff
🔍 [Admin Broadcast] Emitting new message to admin_broadcast room
🔍 [Admin Broadcast] Emitting conversation list update to admin_broadcast room
```

## 1. Thiết lập kết nối Socket.IO và Room Joining

### Socket Service Setup

```typescript
// socket.service.ts
class SocketService {
  private socket: Socket | null = null;
  private user: any = null;

  connect(user: any) {
    this.user = user;

    // Kết nối đến WebSocket server
    this.socket = io('http://localhost:8080', {
      auth: {
        token: user.token, // JWT token
      },
    });

    // Setup connection events
    this.socket.on('connect', () => {
      console.log('✅ [SocketService] Connected to WebSocket server');
      this.joinRooms();
    });

    this.socket.on('disconnect', () => {
      console.log('❌ [SocketService] Disconnected from WebSocket server');
    });
  }

  private joinRooms() {
    if (!this.socket || !this.user) return;

    console.log('🔍 [SocketService] Joining rooms for user:', {
      userId: this.user._id,
      role: this.user.role,
    });

    if (this.user.role === 'admin' || this.user.role === 'staff') {
      // Admin/Staff join admin_broadcast room để nhận tất cả tin nhắn
      console.log(
        '🔍 [SocketService] Admin/Staff joining admin_broadcast room',
      );
      this.socket.emit('admin_join_all_rooms', {
        userId: this.user._id,
        role: this.user.role,
      });
    } else {
      // Guest chỉ join room riêng
      console.log('🔍 [SocketService] Guest joining regular room');
      this.socket.emit('join_room', {
        userId: this.user._id,
        role: this.user.role,
      });
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
```

## 2. Setup Event Listeners trong useMessages Hook

```typescript
// useMessages.ts
import { useEffect, useState } from 'react';
import { socketService } from './socket.service';

export const useMessages = (user: any) => {
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [loading, setLoading] = useState(false);

  const socket = socketService.getSocket();

  // Setup realtime listeners
  const setupRealtimeListeners = () => {
    if (!socket) return;

    console.log(
      '🔍 [useMessages] Setting up realtime listeners for role:',
      user.role,
    );

    // 1. New message event
    socket.on('new_message', (data) => {
      console.log('🔍 [useMessages] Received new_message:', data);
      handleNewMessage(data);
    });

    // 2. Conversation update event (legacy)
    socket.on('conversation_update', (data) => {
      console.log('🔍 [useMessages] Received conversation_update:', data);
      handleConversationUpdate(data);
    });

    // 3. Conversation update V2 event (recommended)
    socket.on('conversation_update_v2', (data) => {
      console.log('🔍 [useMessages] Received conversation_update_v2:', data);
      handleConversationUpdateV2(data);
    });

    // 4. Conversation list update event (NEW - cho admin/staff)
    socket.on('conversation_list_update', (data) => {
      console.log('🔍 [useMessages] Received conversation_list_update:', data);
      handleConversationListUpdate(data);
    });

    // 5. Reaction update event
    socket.on('reaction_update', (data) => {
      console.log('🔍 [useMessages] Received reaction_update:', data);
      handleReactionUpdate(data);
    });

    // 6. Message recall event
    socket.on('message_recalled', (data) => {
      console.log('🔍 [useMessages] Received message_recalled:', data);
      handleMessageRecalled(data);
    });
  };

  // Cleanup listeners
  const cleanupListeners = () => {
    if (!socket) return;

    console.log('🧹 [useMessages] Cleaning up socket event listeners');

    socket.off('new_message');
    socket.off('conversation_update');
    socket.off('conversation_update_v2');
    socket.off('conversation_list_update');
    socket.off('reaction_update');
    socket.off('message_recalled');
  };

  // Event Handlers
  const handleNewMessage = (data: any) => {
    const { conversationId, content, sender_id, sent_at, _id } = data;

    console.log('🔍 [useMessages] Handling new message:', {
      conversationId,
      sender_id,
      currentConversationId,
    });

    // Cập nhật danh sách conversations
    setConversations((prev) => {
      const updated = prev.map((conv) => {
        if (conv._id === conversationId) {
          return {
            ...conv,
            lastMessage: {
              content,
              sender_id,
              sent_at,
              is_read: 'sent',
            },
            lastMessageAt: sent_at,
            messageCount: (conv.messageCount || 0) + 1,
            // Tăng unreadCount nếu tin nhắn không phải của người dùng hiện tại
            unreadCount: conv.unreadCount + (sender_id !== user._id ? 1 : 0),
          };
        }
        return conv;
      });

      // Sắp xếp lại để cuộc trò chuyện có tin nhắn mới nhất lên đầu
      return updated.sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() -
          new Date(a.lastMessageAt).getTime(),
      );
    });

    // Cập nhật messages nếu đang mở cuộc trò chuyện này
    if (currentConversationId === conversationId) {
      setMessages((prev) => [...prev, data]);
    }
  };

  const handleConversationUpdateV2 = (data: any) => {
    const { conversationId, lastMessage, lastMessageAt, unreadCount } = data;

    console.log('🔍 [useMessages] Handling conversation_update_v2:', {
      conversationId,
      unreadCount,
    });

    setConversations((prev) => {
      const updated = prev.map((conv) => {
        if (conv._id === conversationId) {
          return {
            ...conv,
            lastMessage,
            lastMessageAt,
            unreadCount,
          };
        }
        return conv;
      });

      return updated.sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() -
          new Date(a.lastMessageAt).getTime(),
      );
    });
  };

  const handleConversationListUpdate = (data: any) => {
    const { conversations: newConversations, ui_for } = data;

    console.log('🔍 [useMessages] Handling conversation_list_update:', {
      ui_for,
      conversationCount: newConversations?.length || 0,
    });

    // Cập nhật toàn bộ danh sách conversations
    setConversations(newConversations);
  };

  const handleConversationUpdate = (data: any) => {
    const {
      conversationId,
      messages: newMessages,
      updatedBy,
      timestamp,
      messageCount,
    } = data;

    console.log('🔍 [useMessages] Handling conversation_update:', {
      conversationId,
      messageCount,
    });

    // Cập nhật messages nếu đang mở cuộc trò chuyện này
    if (currentConversationId === conversationId) {
      setMessages(newMessages);
    }

    // Cập nhật conversation list
    setConversations((prev) => {
      const updated = prev.map((conv) => {
        if (conv._id === conversationId) {
          return {
            ...conv,
            lastMessage: newMessages[newMessages.length - 1],
            lastMessageAt:
              newMessages[newMessages.length - 1]?.sent_at ||
              conv.lastMessageAt,
            messageCount: messageCount,
          };
        }
        return conv;
      });

      return updated.sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() -
          new Date(a.lastMessageAt).getTime(),
      );
    });
  };

  const handleReactionUpdate = (data: any) => {
    const { message } = data;

    console.log('🔍 [useMessages] Handling reaction_update:', {
      messageId: message._id,
    });

    setMessages((prev) => {
      return prev.map((msg) => {
        if (msg._id === message._id) {
          return { ...msg, reactions: message.reactions };
        }
        return msg;
      });
    });
  };

  const handleMessageRecalled = (data: any) => {
    const { message } = data;

    console.log('🔍 [useMessages] Handling message_recalled:', {
      messageId: message._id,
    });

    setMessages((prev) => {
      return prev.map((msg) => {
        if (msg._id === message._id) {
          return {
            ...msg,
            content: message.content,
            is_recalled: true,
          };
        }
        return msg;
      });
    });
  };

  // Load conversations
  const loadConversations = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const ui_for = user.role === 'admin' ? 'admin' : user.role;
      const response = await fetch(
        `/api/messages/conversations?ui_for=${ui_for}`,
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        },
      );

      const result = await response.json();

      if (result.success) {
        setConversations(result.data);
        console.log(
          '✅ [useMessages] Loaded conversations:',
          result.data.length,
        );
      }
    } catch (error) {
      console.error('❌ [useMessages] Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load messages for a conversation
  const loadMessages = async (conversationId: string) => {
    if (!user || !conversationId) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/messages/conversation?conversationId=${conversationId}`,
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        },
      );

      const result = await response.json();

      if (result.success) {
        setMessages(result.data);
        setCurrentConversationId(conversationId);
        console.log(
          '✅ [useMessages] Loaded messages for conversation:',
          conversationId,
        );
      }
    } catch (error) {
      console.error('❌ [useMessages] Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  // Send message
  const sendMessage = async (conversationId: string, content: string) => {
    if (!user || !conversationId || !content.trim()) return;

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          conversationId,
          content,
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ [useMessages] Message sent successfully');
        // Không cần thêm message vào state vì sẽ nhận được qua realtime
      }
    } catch (error) {
      console.error('❌ [useMessages] Failed to send message:', error);
    }
  };

  // useEffect để setup socket connection và listeners
  useEffect(() => {
    if (user && socket) {
      console.log('🔍 [useMessages] Setting up socket connection for user:', {
        userId: user._id,
        role: user.role,
      });

      // Setup listeners
      setupRealtimeListeners();

      // Load initial conversations
      loadConversations();

      // Cleanup function
      return () => {
        cleanupListeners();
      };
    }
  }, [user, socket]);

  return {
    conversations,
    messages,
    currentConversationId,
    loading,
    loadConversations,
    loadMessages,
    sendMessage,
    setCurrentConversationId,
  };
};
```

## 3. Sử dụng trong Component

```typescript
// MessagesComponent.tsx
import React, { useEffect } from 'react';
import { useMessages } from './useMessages';
import { socketService } from './socket.service';

const MessagesComponent = ({ user }: { user: any }) => {
  const {
    conversations,
    messages,
    currentConversationId,
    loading,
    loadConversations,
    loadMessages,
    sendMessage,
    setCurrentConversationId
  } = useMessages(user);

  // Connect to socket when component mounts
  useEffect(() => {
    if (user) {
      socketService.connect(user);
    }

    return () => {
      socketService.disconnect();
    };
  }, [user]);

  const handleSendMessage = (content: string) => {
    if (currentConversationId) {
      sendMessage(currentConversationId, content);
    }
  };

  const handleConversationClick = (conversationId: string) => {
    setCurrentConversationId(conversationId);
    loadMessages(conversationId);
  };

  return (
    <div className="messages-container">
      {/* Conversation List */}
      <div className="conversation-list">
        {conversations.map((conversation) => (
          <div
            key={conversation._id}
            className={`conversation-item ${currentConversationId === conversation._id ? 'active' : ''}`}
            onClick={() => handleConversationClick(conversation._id)}
          >
            <div className="conversation-avatar">
              <img src={conversation.display?.avatar_url} alt="avatar" />
            </div>
            <div className="conversation-info">
              <div className="conversation-title">{conversation.display?.title}</div>
              <div className="conversation-subtitle">{conversation.display?.subtitle}</div>
            </div>
            {conversation.display?.unreadCount > 0 && (
              <div className="unread-badge">{conversation.display.unreadCount}</div>
            )}
          </div>
        ))}
      </div>

      {/* Messages */}
      <div className="messages-content">
        {currentConversationId ? (
          <div className="messages-list">
            {messages.map((message) => (
              <div
                key={message._id}
                className={`message ${message.sender_id === user._id ? 'own' : 'other'}`}
              >
                <div className="message-content">
                  {message.is_recalled ? (
                    <em>Tin nhắn đã được thu hồi</em>
                  ) : (
                    message.content
                  )}
                </div>
                <div className="message-time">
                  {new Date(message.sent_at).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-conversation">
            Chọn một cuộc trò chuyện để bắt đầu
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesComponent;
```

## 4. Checklist để Debug

### Backend đã sẵn sàng:

- ✅ WebSocket server chạy trên `http://localhost:8080`
- ✅ Admin/Staff join `admin_broadcast` room
- ✅ Tất cả events được emit đến đúng rooms
- ✅ CORS được cấu hình cho frontend

### Frontend cần kiểm tra:

1. **Socket Connection:**

   ```javascript
   // Kiểm tra trong console
   console.log('Socket connected:', socket.connected);
   console.log('Socket ID:', socket.id);
   ```

2. **Room Joining:**

   ```javascript
   // Kiểm tra admin/staff có join admin_broadcast room
   socket.emit('admin_join_all_rooms', { userId: user._id, role: user.role });
   ```

3. **Event Listening:**

   ```javascript
   // Kiểm tra tất cả events được listen
   socket.on('new_message', (data) =>
     console.log('New message received:', data),
   );
   socket.on('conversation_update_v2', (data) =>
     console.log('Conversation update received:', data),
   );
   socket.on('conversation_list_update', (data) =>
     console.log('Conversation list update received:', data),
   );
   ```

4. **API Calls:**

   ```javascript
   // Kiểm tra API calls với đúng ui_for parameter
   // Guest: /api/messages/conversations?ui_for=guest
   // Staff: /api/messages/conversations?ui_for=staff
   // Admin: /api/messages/conversations?ui_for=admin
   ```

## 5. Troubleshooting

### Vấn đề thường gặp:

1. **Socket không kết nối:**

   - Kiểm tra WebSocket URL: `http://localhost:8080`
   - Kiểm tra JWT token có hợp lệ
   - Kiểm tra CORS configuration

2. **Admin/Staff không nhận được tin nhắn:**

   - Đảm bảo đã join `admin_broadcast` room
   - Kiểm tra role trong user object
   - Kiểm tra event listeners đã được setup

3. **Guest không nhận được tin nhắn:**

   - Đảm bảo đã join room riêng với `userId`
   - Kiểm tra event listeners

4. **Conversation list không update:**

   - Kiểm tra `conversation_list_update` event listener
   - Kiểm tra `handleConversationListUpdate` function
   - Đảm bảo state được update đúng cách

### Debug Commands:

```javascript
// Trong browser console
// Kiểm tra socket connection
console.log('Socket:', socket);
console.log('Connected:', socket.connected);
console.log('User:', user);

// Kiểm tra event listeners
console.log('Event listeners:', socket.eventNames());

// Test emit
socket.emit('test', { message: 'test' });
```

## 6. Tóm tắt Events cần Listen

| Event                      | Mô tả                                    | Role        |
| -------------------------- | ---------------------------------------- | ----------- |
| `new_message`              | Tin nhắn mới                             | All         |
| `conversation_update`      | Cập nhật conversation (legacy)           | All         |
| `conversation_update_v2`   | Cập nhật conversation với unread count   | All         |
| `conversation_list_update` | Cập nhật toàn bộ danh sách conversations | Admin/Staff |
| `reaction_update`          | Cập nhật reactions                       | All         |
| `message_recalled`         | Tin nhắn bị thu hồi                      | All         |

## 7. API Endpoints

| Endpoint                                    | Method | Role  | Realtime |
| ------------------------------------------- | ------ | ----- | -------- |
| `/messages/conversations?ui_for=guest`      | GET    | Guest | ✅       |
| `/messages/conversations?ui_for=staff`      | GET    | Staff | ✅       |
| `/messages/conversations?ui_for=admin`      | GET    | Admin | ✅       |
| `/messages/conversation?conversationId=...` | GET    | All   | ✅       |
| `/messages`                                 | POST   | All   | ✅       |

## 🚨 QUAN TRỌNG: Test Realtime cho Admin/Staff

### Test Case 1: Admin gửi tin nhắn

1. Admin gửi tin nhắn
2. Guest nhận được realtime ✅
3. Staff nhận được realtime ✅
4. Admin nhận được realtime ✅

### Test Case 2: Guest gửi tin nhắn

1. Guest gửi tin nhắn
2. Guest nhận được realtime ✅
3. Staff nhận được realtime ❌ (Cần fix)
4. Admin nhận được realtime ❌ (Cần fix)

### Test Case 3: Staff gửi tin nhắn

1. Staff gửi tin nhắn
2. Guest nhận được realtime ✅
3. Staff nhận được realtime ✅
4. Admin nhận được realtime ✅

**Vấn đề chính: Guest gửi tin nhắn thì Staff/Admin không nhận được realtime**

### 🔧 Fix cho vấn đề này:

1. **Kiểm tra Backend logs** khi guest gửi tin nhắn:

   ```
   🔍 Emitted new message to admin broadcast room
   🔍 Emitted conversation update V2 to admin broadcast room
   ```

2. **Kiểm tra Frontend** có listen events không:

   ```javascript
   socket.on('new_message', (data) => {
     console.log('🔍 [ADMIN/STAFF] Received new_message:', data);
     // Cập nhật UI
   });
   ```

3. **Kiểm tra Room joining**:

   ```javascript
   console.log('Socket rooms:', Array.from(socket.rooms));
   // Phải thấy 'admin_broadcast' trong danh sách
   ```

## 🧪 TEST REALTIME EVENTS

### **Bước 1: Test Backend Realtime Emission**

Gọi API test để kiểm tra backend có emit events đúng không:

```javascript
// Test backend realtime emission
fetch('/api/messages/test-realtime', {
  headers: { Authorization: `Bearer ${user.token}` },
})
  .then((res) => res.json())
  .then((data) => {
    console.log('🔍 [TEST] Backend test response:', data);
  });
```

### **Bước 2: Test Frontend Event Reception**

Trong browser console, test listen events:

```javascript
// Test listen new_message event
socket.on('new_message', (data) => {
  console.log('🔍 [TEST] Received new_message event:', data);
  console.log('🔍 [TEST] Message content:', data.content);
  console.log('🔍 [TEST] Sender ID:', data.sender_id);
  console.log('🔍 [TEST] Conversation ID:', data.conversationId);
});

// Test listen conversation_list_update event
socket.on('conversation_list_update', (data) => {
  console.log('🔍 [TEST] Received conversation_list_update event:', data);
  console.log('🔍 [TEST] Conversations count:', data.conversations?.length);
  console.log('🔍 [TEST] UI for:', data.ui_for);
});
```

### **Bước 3: Kiểm tra Data Structure**

Khi nhận được events, kiểm tra data structure:

```javascript
// Kiểm tra new_message event structure
socket.on('new_message', (data) => {
  console.log('🔍 [STRUCTURE] new_message data:', {
    hasId: !!data._id,
    hasContent: !!data.content,
    hasSenderId: !!data.sender_id,
    hasConversationId: !!data.conversationId,
    hasPropertyId: !!data.propertyId,
    hasGuestId: !!data.guestId,
    hasType: !!data.type,
    contentLength: data.content?.length || 0,
    fullData: data,
  });
});

// Kiểm tra conversation_list_update event structure
socket.on('conversation_list_update', (data) => {
  console.log('🔍 [STRUCTURE] conversation_list_update data:', {
    hasConversations: !!data.conversations,
    conversationsLength: data.conversations?.length || 0,
    hasUiFor: !!data.ui_for,
    hasType: !!data.type,
    firstConversation: data.conversations?.[0],
    fullData: data,
  });
});
```

### **Bước 4: Debug Room Joining**

Kiểm tra admin/staff có join đúng room không:

```javascript
// Kiểm tra room joining
console.log('🔍 [ROOMS] Current socket rooms:', Array.from(socket.rooms));

// Force join admin_broadcast room
if (user.role === 'admin' || user.role === 'staff') {
  socket.emit('admin_join_all_rooms', {
    userId: user._id,
    role: user.role,
  });

  // Kiểm tra lại sau khi join
  setTimeout(() => {
    console.log(
      '🔍 [ROOMS] After joining admin_broadcast:',
      Array.from(socket.rooms),
    );
  }, 1000);
}
```

### **Bước 5: Test Complete Flow**

1. **Mở 2 tab browser** (1 cho admin, 1 cho guest)
2. **Admin tab**: Gọi test API
3. **Guest tab**: Gửi tin nhắn thật
4. **Kiểm tra logs** ở cả 2 tab

```javascript
// Tab Admin - Test API
fetch('/api/messages/test-realtime', {
  headers: { Authorization: `Bearer ${adminToken}` },
})
  .then((res) => res.json())
  .then((data) => console.log('Admin test result:', data));

// Tab Guest - Send real message
fetch('/api/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${guestToken}`,
  },
  body: JSON.stringify({
    conversationId: 'your_conversation_id',
    content: 'Test message from guest',
  }),
})
  .then((res) => res.json())
  .then((data) => console.log('Guest send result:', data));
```

### **Bước 6: Kiểm tra Backend Logs**

Trong backend console, tìm các log sau:

```
🔍 [Service] Created lastMessage object: { _id: '...', content: '...', sender_id: '...', sender_role: 'guest', contentLength: 15 }
🔍 Emitted new message to admin broadcast room with data: { messageId: '...', conversationId: '...', content: '...', sender_id: '...' }
🔍 Emitted conversation update V2 to admin broadcast room
🔍 [Conversations API] Emitted realtime update for admin/staff
```

### **🚨 VẤN ĐỀ CÓ THỂ GẶP:**

1. **`lastMessage.content` là empty string**: Backend đã fix với `saved.content || ''`
2. **Frontend không nhận được `new_message` event**: Kiểm tra room joining
3. **Frontend nhận được event nhưng không update UI**: Kiểm tra event handlers
4. **Socket connection bị disconnect**: Kiểm tra connection status

### **✅ KHI TEST THÀNH CÔNG:**

- Backend logs hiển thị đầy đủ thông tin
- Frontend nhận được events với data structure đúng
- UI tự động update khi có tin nhắn mới
- Admin/Staff nhận được realtime từ Guest messages
