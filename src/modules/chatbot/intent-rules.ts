export const STATIC_RESPONSES = {
  ask_voucher:
    'Hiện tại chưa có voucher nào áp dụng. Đừng lo, hãy theo dõi Fanpage của chúng tôi để cập nhật ngay những ưu đãi hấp dẫn nhất cho kỳ nghỉ mơ ước của bạn nhé! 🔥',
  greeting:
    'Xin chào! Rất vui được hỗ trợ bạn! Bạn đang tìm phòng nghỉ giá rẻ, voucher giảm giá hay thông tin du lịch tại đâu? Hãy cho tôi biết để tôi giúp bạn ngay! 😊',
  goodbye:
    'Tạm biệt! Chúc bạn có một chuyến đi tuyệt vời và đừng quên quay lại với chúng tôi nhé! 🌟',
  unknown:
    'Tôi chưa có thông tin. Vui lòng cung cấp thêm thông tin để tôi hỗ trợ tốt hơn, hoặc thử hỏi về phòng nghỉ giá rẻ, voucher giảm giá, hay dịch vụ tại Vinaside nhé! 😄',
  ask_cheapest_room: '',
  'message.send':
    'Nhân viên được gán vào property sẽ có quyền trả lời tin nhắn liên quan đến property đó.',
  ask_booking_process:
    '📋 **Quy trình đặt phòng tại Vinaside:**\n\n1️⃣ **Tìm phòng:** Chọn phòng phù hợp với nhu cầu và ngân sách\n2️⃣ **Kiểm tra lịch:** Xem ngày trống và đặt lịch\n3️⃣ **Điền thông tin:** Cung cấp thông tin cá nhân và thanh toán\n4️⃣ **Xác nhận:** Nhận email xác nhận đặt phòng\n5️⃣ **Check-in:** Đến nhận phòng theo lịch đã đặt\n\n💳 **Thanh toán:** Chấp nhận VNPay, MoMo, tiền mặt\n📞 **Hỗ trợ:** Liên hệ 0909.123.456 để được tư vấn!',
  ask_booking_steps:
    '🚀 **Các bước đặt phòng chi tiết:**\n\n**Bước 1: Tìm kiếm** 🔍\n- Chọn địa điểm và ngày check-in/check-out\n- Lọc theo giá, tiện nghi, đánh giá\n\n**Bước 2: Chọn phòng** 🏠\n- Xem chi tiết phòng và hình ảnh\n- Kiểm tra chính sách hủy phòng\n\n**Bước 3: Đặt phòng** 📝\n- Điền thông tin cá nhân\n- Chọn phương thức thanh toán\n\n**Bước 4: Xác nhận** ✅\n- Nhận email xác nhận\n- Lưu mã đặt phòng\n\n**Bước 5: Check-in** 🎉\n- Đến đúng giờ nhận phòng\n- Xuất trình giấy tờ tùy thân\n\n📞 Cần hỗ trợ? Gọi ngay 0909.123.456!',
  ask_vinaside_info:
    '🏖️ **Vinaside - Nơi nghỉ dưỡng lý tưởng của bạn!**\n\n**🎯 Chúng tôi cung cấp:**\n• Phòng nghỉ chất lượng cao với giá tốt nhất\n• Đa dạng loại phòng: Standard, Deluxe, Suite, Villa\n• Vị trí đắc địa gần biển, trung tâm thành phố\n• Tiện nghi hiện đại: WiFi, điều hòa, TV, bếp\n• Dịch vụ 24/7 và hỗ trợ tận tâm\n\n**📍 Địa điểm nổi bật:**\n• Đà Nẵng: Biển Mỹ Khê, Bán đảo Sơn Trà\n• Hội An: Phố cổ, Biển An Bàng\n• Ngũ Hành Sơn: Núi đá, Biển Non Nước\n\n**💎 Ưu đãi đặc biệt:**\n• Voucher giảm giá thường xuyên\n• Ưu đãi dài ngày\n• Gói combo du lịch\n\n**📞 Liên hệ:** 0909.123.456\n**🌐 Website:** www.vinaside.com\n\nHãy để Vinaside mang đến cho bạn kỳ nghỉ hoàn hảo! ✨',
};

export function detectIntent(
  message: string,
):
  | keyof typeof STATIC_RESPONSES
  | 'ask_price'
  | 'check_availability'
  | 'ask_room_details'
  | 'ask_service'
  | 'ask_reviews'
  | 'ask_family_room'
  | 'ask_view_room'
  | 'ask_pet_policy'
  | 'ask_long_stay_discount'
  | 'ask_event_discount'
  | 'ask_cancellation_policy'
  | 'ask_rooms_by_location'
  | 'ask_property_info'
  | 'ask_room_amenities'
  | 'ask_payment_methods'
  | 'ask_checkin_checkout'
  | 'ask_room_capacity'
  | 'ask_room_photos'
  | 'ask_room_availability_calendar'
  | 'ask_room_location'
  | 'ask_specific_room' {
  const msg = message.toLowerCase().trim();

  const patterns: { [key: string]: RegExp } = {
    // Existing patterns
    ask_price: /(giá|bao nhiêu|cost|price).*(phòng|room)/i,
    check_availability: /(trống|còn phòng|available|book)/i,
    ask_voucher: /(voucher|khuyến mãi|discount|promo)/i,
    greeting: /(^hi$|^xin chào$|^hello$|^chào$)/i,
    goodbye: /(tạm biệt|bye|cảm ơn|goodbye)/i,
    ask_cheapest_room: /(giá rẻ nhất|phòng rẻ nhất|cheapest room|dưới.*triệu)/i,
    ask_room_details: /(chi tiết|thông tin|details).*(phòng|room)/i,
    ask_service: /(dịch vụ|service).*(có gì|available)/i,
    ask_reviews: /(đánh giá|review|rating).*(phòng|room)/i,
    'message.send': /(gán nhân viên|assign staff).*(property)/i,
    ask_family_room: /(gia đình|trẻ nhỏ|family|kids)/i,
    ask_view_room: /(view biển|sea view|ocean view)/i,
    ask_pet_policy: /(thú cưng|pet|dog|cat)/i,
    ask_long_stay_discount: /(dài ngày|long stay|nhiều đêm)/i,
    ask_event_discount: /(lễ|quốc khánh|2\/9|event|special offer)/i,
    ask_cancellation_policy: /(hủy phòng|cancel|cancellation)/i,

    // New location-based patterns
    ask_rooms_by_location:
      /(phòng|room).*(ở|tại|gần|near|location).*(đà nẵng|hội an|sơn trà|ngũ hành sơn|liên chiểu|hải châu|cẩm lệ|thanh khê|hoà vang|biển|beach|trung tâm|center|sân bay|airport|chợ|market|bãi biển|mỹ khê|non nước|bán đảo|peninsula)/i,
    ask_property_info:
      /(khách sạn|hotel|resort|villa|apartment|chỗ nghỉ|nơi ở).*(ở|tại|gần|near)/i,

    // New pattern for specific room location questions
    ask_room_location:
      /(phòng|room).*(ở chỗ nào|ở đâu|location|address|địa chỉ|ở địa điểm nào)/i,

    // Pattern for specific room queries
    ask_specific_room: /(phòng|room)\s+([^ở\s]+(?:\s+[^ở\s]+)*)/i,

    // Enhanced room query patterns
    ask_room_amenities:
      /(tiện nghi|amenity|wifi|tủ lạnh|điều hòa|ac|tv|tivi|bếp|kitchen|máy giặt|washing|parking|bãi xe|swimming|hồ bơi|gym|phòng tập)/i,
    ask_booking_process:
      /(đặt phòng|booking|reserve|đặt|book).*(như thế nào|how|process|quy trình)/i,
    ask_booking_steps:
      /(các bước|steps|quy trình|process).*(đặt phòng|booking|reserve|đặt|book)/i,
    ask_booking_steps_alt:
      /(đặt phòng|booking|reserve|đặt|book).*(các bước|steps|quy trình|process)/i,
    ask_payment_methods:
      /(thanh toán|payment|pay).*(bằng gì|method|cách nào|momo|vnpay|tiền mặt|cash|thẻ|card)/i,
    ask_checkin_checkout:
      /(check.?in|check.?out|nhận phòng|trả phòng|giờ nhận|giờ trả|thời gian).*(mấy giờ|time|when)/i,
    ask_room_capacity:
      /(bao nhiêu người|capacity|sức chứa|max|tối đa).*(người|person|guest)/i,
    ask_room_photos: /(hình ảnh|photo|ảnh|picture|image).*(phòng|room)/i,
    ask_room_availability_calendar:
      /(lịch|calendar|ngày|date).*(trống|available|còn phòng)/i,

    // New patterns for Vinaside information
    ask_vinaside_info:
      /(vinaside|website|trang web).*(có gì|gì|thông tin|giới thiệu)/i,
    ask_vinaside_info_alt:
      /(có gì|gì|thông tin|giới thiệu).*(vinaside|website|trang web)/i,
  };

  for (const [intent, pattern] of Object.entries(patterns)) {
    if (pattern.test(msg)) {
      // Map alternative patterns to main responses
      if (intent === 'ask_vinaside_info_alt') {
        return 'ask_vinaside_info';
      }
      if (intent === 'ask_booking_steps_alt') {
        return 'ask_booking_steps';
      }
      return intent as keyof typeof STATIC_RESPONSES;
    }
  }

  return 'unknown';
}
