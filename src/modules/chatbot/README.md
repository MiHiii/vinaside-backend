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
