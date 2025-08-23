# Chatbot Module

Module chatbot đã được thu gọn, tập trung vào luồng chính: xử lý tin nhắn và trả lời từ AI.

## Tính năng chính

- **Xử lý tin nhắn**: Nhận tin nhắn từ người dùng và trả lời bằng AI
- **Tích hợp Gemini API**: Sử dụng Google Gemini để tạo phản hồi thông minh
- **Config Management**: Quản lý environment variables thông qua Config Service
- **Error Handling**: Xử lý lỗi và fallback gracefully
- **Dữ liệu thực tế**: Tích hợp với database thực của Vinaside (Properties, Listings, Services, Vouchers, Reviews)
- **Prompt tối ưu**: Prompt được thiết kế đặc biệt cho dự án Vinaside với cấu trúc dữ liệu thực tế

## API Endpoints

### POST /chatbot/message

Gửi tin nhắn đến chatbot và nhận phản hồi từ AI.

**Request Body:**

```json
{
  "content": "Tôi muốn tìm phòng ở Đà Nẵng"
}
```

**Response:**

```json
{
  "reply": "🏖️ **Chào bạn!** Tôi sẽ giúp bạn tìm phòng ở Đà Nẵng. Dựa trên dữ liệu hiện có, tôi tìm thấy một số lựa chọn phù hợp:\n\n🏡 **Villa Gió Biển** - Villa cao cấp view biển\n📍 **Địa chỉ**: 123 Đường Biển, Đà Nẵng\n💰 **Giá**: 2,500,000 VNĐ/đêm\n👥 **Sức chứa**: 6 người\n🛏️ **Giường**: 3 giường\n🚿 **Phòng tắm**: 2 phòng tắm\n⭐ **Đánh giá**: 4.8 sao\n\n💡 **Gợi ý**: Villa này phù hợp cho gia đình hoặc nhóm bạn. Có thể sử dụng mã WELCOME2024 để giảm 10%!\n\n📞 **Liên hệ**: 0909.123.456 để đặt phòng ngay!"
}
```

## Cấu hình

### Environment Variables

Tạo file `.env` với các biến sau:

```env
# Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent
GEMINI_TIMEOUT=15000
GEMINI_MAX_PROMPT_LENGTH=8000

# Internal Data API
INTERNAL_DATA_URL=http://localhost:8080/api/v1/internal-data
INTERNAL_DATA_TIMEOUT=10000

# Contact Information
CONTACT_PHONE=0909.123.456
CONTACT_WEBSITE=www.vinaside.com
CHECKIN_TIME=14:00
CHECKOUT_TIME=12:00
```

### Cấu hình Gemini API

1. Đăng ký tài khoản Google Cloud
2. Tạo project và enable Gemini API
3. Tạo API key
4. Thêm API key vào environment variable `GEMINI_API_KEY`

## Cấu trúc Module

```
chatbot/
├── chatbot.controller.ts      # Controller chính (HTTP API)
├── ai-chatbot.service.ts      # AI service xử lý logic chính
├── chatbot.gateway.ts         # WebSocket gateway
├── chatbot.module.ts          # Module configuration
├── intent-rules.ts            # Quy tắc nhận diện ý định
├── response-formatter.ts      # Format responses cho Frontend
├── helpers/                   # Helper functions (slots management)
├── dto/                       # Data Transfer Objects
├── schemas/                   # Database schemas
└── interfaces/                # Interfaces
```

## Dữ liệu được tích hợp

Chatbot có thể truy cập và trả lời về:

- **Properties**: Thông tin tài sản (homestay, villa, apartment)
- **Listings**: Chi tiết phòng, giá cả, tiện nghi
- **Services**: Dịch vụ bổ sung (đưa đón, dọn phòng, massage)
- **Vouchers**: Mã giảm giá và điều kiện sử dụng
- **Reviews**: Đánh giá và nhận xét từ khách hàng
- **Bookings**: Thông tin đặt phòng và trạng thái

## Các câu hỏi mà Chatbot có thể trả lời

### 🏠 **Tìm kiếm & Đặt phòng**

- "Tôi muốn tìm phòng ở Đà Nẵng"
- "Có phòng nào trống ngày 25/8 không?"
- "Tìm phòng cho 4 người ở 3 đêm"
- "Phòng ở Hội An giá bao nhiêu?"
- "Hồ Chí Minh có phòng nào trống ngày 28/8"

### 📋 **Quy trình & Chính sách**

- "Quy trình đặt phòng như thế nào?"
- "Thanh toán như nào?"
- "Chính sách hủy phòng ra sao?"
- "Check-in check-out lúc mấy giờ?"

### 🏷️ **Chi tiết phòng**

- "Chi tiết Phòng Nắng Ấm"
- "Thông tin về phòng Deluxe"
- "Phòng này có những tiện nghi gì?"
- "Phòng có view biển không?"

### 🎁 **Dịch vụ & Ưu đãi**

- "Có những dịch vụ gì?"
- "Voucher hiện tại như thế nào?"
- "Có ưu đãi gì không?"
- "Dịch vụ massage giá bao nhiêu?"

### 📍 **Thông tin địa điểm**

- "Gần đây có gì?"
- "Cách biển bao xa?"
- "Đi từ sân bay như thế nào?"
- "Xung quanh có quán ăn gì?"

### ⭐ **Đánh giá & Phản hồi**

- "Phòng này có đánh giá thế nào?"
- "Khách hàng nói gì về chỗ này?"
- "Rating bao nhiêu sao?"

## Quy trình phát triển Chatbot

### 🎯 **Phase 1: Phân tích yêu cầu (Requirements Analysis)**

1. **Xác định mục tiêu**:

   - Tự động hóa việc tư vấn đặt phòng
   - Giảm tải cho nhân viên customer service
   - Cải thiện trải nghiệm khách hàng 24/7
   - Tích hợp với hệ thống backend hiện có

2. **Phân tích user stories**:
   - Khách hàng muốn tìm phòng theo tiêu chí
   - Khách hàng cần thông tin chi tiết về phòng
   - Khách hàng muốn biết quy trình đặt phòng
   - Khách hàng cần hỗ trợ về chính sách

### 🏗️ **Phase 2: Thiết kế kiến trúc (Architecture Design)**

1. **Slot-based Conversation Flow**:

   ```
   load → extract → merge → save → if missing ask once → else search/hold
   ```

2. **Intent Detection System**:

   - Room search requests
   - Room detail requests
   - General information requests
   - Service/voucher requests
   - Payment/policy requests

3. **Response Formatting**:
   - Text responses for general info
   - Listings format for room results
   - Availability format for booking status
   - Structured data for frontend

### 🔧 **Phase 3: Core Development**

1. **Slot Management System** (`helpers/slots.ts`):

   - `extractSlotsFromText()`: Trích xuất thông tin từ tin nhắn
   - `mergeSlots()`: Gộp thông tin mới với context cũ
   - `missingForSearch()`: Kiểm tra thông tin còn thiếu
   - Context clearing logic cho conversation flow

2. **Intent Detection** (`helpers/slots.ts`):

   - `isRoomDetailRequest()`: Phát hiện yêu cầu chi tiết phòng
   - `isGeneralInfoRequest()`: Phát hiện câu hỏi chung
   - `isServiceRequest()`: Phát hiện câu hỏi về dịch vụ
   - `isPaymentMethodsRequest()`: Phát hiện câu hỏi thanh toán
   - `isBookingProcessRequest()`: Phát hiện câu hỏi quy trình

3. **Response Formatting** (`response-formatter.ts`):
   - `formatListingsResponse()`: Format danh sách phòng
   - `formatTextResponse()`: Format câu trả lời text
   - `formatAvailabilityResponse()`: Format thông tin availability
   - Dynamic header và meta data generation

### 🤖 **Phase 4: AI Integration**

1. **Gemini API Integration** (`ai-chatbot.service.ts`):

   - Prompt engineering cho domain cụ thể
   - Context management với internal data
   - Error handling và fallback logic
   - Function calling cho database queries

2. **Hybrid Approach**:
   - Rule-based system cho câu hỏi thường gặp
   - AI-powered responses cho câu hỏi phức tạp
   - Slot-filling cho conversation management

### 🔄 **Phase 5: WebSocket & HTTP APIs**

1. **WebSocket Gateway** (`chatbot.gateway.ts`):

   - Real-time messaging với Socket.IO
   - Session management với Redis
   - Connection handling và room management
   - Typing indicators và status updates

2. **HTTP Controller** (`chatbot.controller.ts`):
   - RESTful API cho mobile/web integration
   - Same logic as WebSocket cho consistency
   - JWT authentication và authorization

### 📊 **Phase 6: Data Integration**

1. **Internal API Integration**:

   - Real-time data từ `/api/v1/internal-data`
   - Properties, Listings, Services, Vouchers
   - Reviews và Bookings data
   - Availability checking logic

2. **Database Schema** (`schemas/`):
   - ChatbotMessage schema cho message history
   - Session management cho conversation state

### 🎨 **Phase 7: Response Enhancement**

1. **Dynamic Content Generation**:

   - Contextual responses based on user data
   - Personalized recommendations
   - Location-aware suggestions
   - Time-sensitive information

2. **Multi-format Responses**:
   - Text cho general information
   - Listings cho room search results
   - Structured data cho frontend components
   - Rich media support preparation

### 🧪 **Phase 8: Testing & Optimization**

1. **Conversation Flow Testing**:

   - Slot extraction accuracy
   - Context management effectiveness
   - Intent detection precision
   - Response relevance validation

2. **Performance Optimization**:

   - Response time optimization
   - Memory usage optimization
   - Caching strategies implementation
   - Error recovery mechanisms

3. **User Experience Testing**:
   - Natural conversation flow
   - Context retention across messages
   - Fallback behavior validation
   - Edge case handling

### 🚀 **Phase 9: Deployment & Monitoring**

1. **Production Deployment**:

   - Environment configuration
   - Security measures implementation
   - Rate limiting setup
   - Monitoring và logging

2. **Continuous Improvement**:
   - User feedback collection
   - Conversation analytics
   - Intent detection refinement
   - Response quality improvement

### 📈 **Key Technical Decisions**

1. **Hybrid Architecture**: Kết hợp rule-based và AI-powered responses
2. **Slot-based Management**: Structured conversation state management
3. **Intent-first Design**: Phân loại intent trước khi xử lý
4. **Context Awareness**: Smart context clearing và retention
5. **Real-time Integration**: Live data từ internal APIs
6. **Flexible Response Format**: Support multiple frontend requirements

## 🔄 **Luồng hoạt động chính của hệ thống**

### **📱 Phía Frontend (Giao diện người dùng)**

1. **Người dùng nhập tin nhắn**

   - Gõ câu hỏi vào ô chat
   - Ví dụ: "Tôi muốn tìm phòng ở Đà Nẵng"

2. **Gửi tin nhắn lên server**

   - Frontend gửi tin nhắn qua WebSocket hoặc HTTP
   - Hiển thị "đang nhập..." để người dùng biết hệ thống đang xử lý

3. **Nhận và hiển thị câu trả lời**
   - Nhận câu trả lời từ server
   - Hiển thị theo định dạng phù hợp:
     - **Dạng text**: Thông tin chung, quy trình, chính sách
     - **Dạng danh sách**: Danh sách phòng với hình ảnh, giá cả
     - **Dạng chi tiết**: Thông tin chi tiết một phòng cụ thể

### **🖥️ Phía Backend (Máy chủ)**

1. **Nhận tin nhắn từ người dùng**

   - Server nhận tin nhắn qua WebSocket hoặc HTTP API
   - Kiểm tra tin nhắn có hợp lệ không (không rỗng, không quá dài)

2. **Tìm hiểu ý định của người dùng**

   - Phân tích tin nhắn để hiểu người dùng muốn gì:
     - Tìm phòng? → Cần biết địa điểm, ngày, số người
     - Hỏi thông tin? → Cần trả lời về dịch vụ, chính sách
     - Xem chi tiết phòng? → Cần tìm thông tin phòng cụ thể

3. **Thu thập thông tin cần thiết**

   - Nếu người dùng chưa cung cấp đủ thông tin:
     - Hỏi lại: "Bạn muốn tìm phòng ở đâu?"
     - Hỏi thêm: "Bạn đi mấy người?"
   - Nếu đã đủ thông tin: Tiến hành tìm kiếm

4. **Tìm kiếm và xử lý dữ liệu**

   - Truy vấn cơ sở dữ liệu để tìm phòng phù hợp
   - Kiểm tra phòng còn trống không
   - Tính toán giá cả và ưu đãi
   - Lấy thông tin đánh giá từ khách hàng

5. **Tạo câu trả lời**

   - Nếu tìm thấy phòng: Trả về danh sách phòng với đầy đủ thông tin
   - Nếu không tìm thấy: Thông báo và gợi ý tìm kiếm khác
   - Nếu là câu hỏi chung: Sử dụng AI để trả lời thông minh

6. **Gửi câu trả lời về Frontend**
   - Đóng gói câu trả lời theo định dạng chuẩn
   - Gửi về cho Frontend hiển thị

### **💾 Lưu trữ và Quản lý phiên làm việc**

1. **Lưu lịch sử trò chuyện**

   - Mỗi tin nhắn được lưu vào cơ sở dữ liệu
   - Giúp theo dõi và cải thiện chất lượng chatbot

2. **Quản lý phiên làm việc**

   - Lưu thông tin tạm thời về cuộc trò chuyện
   - Ví dụ: Người dùng đã nói muốn tìm phòng ở Đà Nẵng
   - Khi họ nói tiếp "cho 2 người", hệ thống hiểu là 2 người ở Đà Nẵng

3. **Tự động xóa thông tin cũ**
   - Sau 30 phút không hoạt động, thông tin cũ sẽ bị xóa
   - Đảm bảo thông tin luôn mới và chính xác

### **🔄 Luồng xử lý chi tiết**

```
Người dùng gửi tin nhắn
         ↓
Server nhận và phân tích
         ↓
Kiểm tra loại câu hỏi:
├─ Tìm phòng? → Thu thập thông tin → Tìm kiếm → Trả kết quả
├─ Hỏi dịch vụ? → Lấy danh sách dịch vụ → Trả kết quả
├─ Hỏi chính sách? → Trả thông tin chính sách
└─ Câu hỏi khác? → Dùng AI trả lời
         ↓
Gửi câu trả lời về Frontend
         ↓
Frontend hiển thị cho người dùng
```

### **🎯 Các trường hợp xử lý đặc biệt**

1. **Người dùng chưa cung cấp đủ thông tin**

   - Hệ thống hỏi từng thông tin một cách thông minh
   - Ví dụ: "Bạn muốn tìm phòng ở đâu?" → "Bạn đi mấy người?" → "Bạn ở mấy đêm?"

2. **Không tìm thấy phòng phù hợp**

   - Thông báo rõ ràng và gợi ý tìm kiếm khác
   - Ví dụ: "Hiện không có phòng trống, bạn thử ngày khác nhé"

3. **Câu hỏi phức tạp**

   - Sử dụng AI để hiểu và trả lời thông minh
   - Ví dụ: "Gần đây có gì thú vị không?" → AI trả lời về địa điểm du lịch

4. **Lỗi hệ thống**
   - Thông báo lỗi thân thiện
   - Gợi ý liên hệ nhân viên để được hỗ trợ

## Sử dụng

### 1. Import Module

```typescript
import { ChatbotModule } from './modules/chatbot/chatbot.module';

@Module({
  imports: [ChatbotModule],
})
export class AppModule {}
```

### 2. Inject Service

```typescript
import { AIChatbotService } from './modules/chatbot/ai-chatbot.service';

@Injectable()
export class YourService {
  constructor(private aiChatbotService: AIChatbotService) {}

  async handleUserMessage(message: string) {
    return this.aiChatbotService.processMessage(message);
  }
}
```

## Error Handling

Module xử lý các lỗi sau:

- **API Key không hợp lệ**: Trả về thông báo lỗi thân thiện
- **Network timeout**: Retry và fallback
- **Invalid prompt**: Validate và cắt ngắn prompt
- **Internal data fetch failed**: Tiếp tục với dữ liệu có sẵn

## Monitoring

- Logs được ghi chi tiết cho debugging
- Error tracking cho các lỗi API
- Performance monitoring cho response time

## Security

- JWT authentication required
- Input validation và sanitization
- Rate limiting (có thể thêm)
- CORS configuration

## Performance

- Prompt caching để tối ưu response time
- Timeout configuration để tránh hanging requests
- Memory management cho large prompts
