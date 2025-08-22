export const STATIC_RESPONSES = {
  ask_voucher:
    'Hiện tại chưa có voucher nào áp dụng. Đừng lo, hãy theo dõi Fanpage của chúng tôi để cập nhật ngay những ưu đãi hấp dẫn nhất cho kỳ nghỉ mơ ước của bạn nhé!',
  greeting:
    'Xin chào! Rất vui được hỗ trợ bạn! Bạn đang tìm phòng nghỉ giá rẻ, voucher giảm giá hay thông tin du lịch tại đâu? Hãy cho tôi biết để tôi giúp bạn ngay!',
  goodbye:
    'Tạm biệt! Chúc bạn có một chuyến đi tuyệt vời và đừng quên quay lại với chúng tôi nhé!',
  unknown:
    'Tôi chưa có thông tin. Vui lòng cung cấp thêm thông tin để tôi hỗ trợ tốt hơn, hoặc thử hỏi về phòng nghỉ giá rẻ, voucher giảm giá, hay dịch vụ tại Vinaside nhé!',
  ask_cheapest_room: '',
  'message.send':
    'Nhân viên được gán vào property sẽ có quyền trả lời tin nhắn liên quan đến property đó.',
  ask_booking_process:
    '**Quy trình đặt phòng tại Vinaside:**\n\n1. **Tìm phòng:** Chọn phòng phù hợp với nhu cầu và ngân sách\n2. **Kiểm tra lịch:** Xem ngày trống và đặt lịch\n3. **Điền thông tin:** Cung cấp thông tin cá nhân và thanh toán\n4. **Xác nhận:** Nhận email xác nhận đặt phòng\n5. **Check-in:** Đến nhận phòng theo lịch đã đặt\n\n**Thanh toán:** Chấp nhận VNPay, MoMo, tiền mặt\n**Hỗ trợ:** Liên hệ 0909.123.456 để được tư vấn!',
  ask_booking_steps:
    '**Các bước đặt phòng chi tiết:**\n\n**Bước 1: Tìm kiếm**\n- Chọn địa điểm và ngày check-in/check-out\n- Lọc theo giá, tiện nghi, đánh giá\n\n**Bước 2: Chọn phòng**\n- Xem chi tiết phòng và hình ảnh\n- Kiểm tra chính sách hủy phòng\n\n**Bước 3: Đặt phòng**\n- Điền thông tin cá nhân\n- Chọn phương thức thanh toán\n\n**Bước 4: Xác nhận**\n- Nhận email xác nhận\n- Lưu mã đặt phòng\n\n**Bước 5: Check-in**\n- Đến đúng giờ nhận phòng\n- Xuất trình giấy tờ tùy thân\n\nCần hỗ trợ? Gọi ngay 0909.123.456!',
  ask_vinaside_info:
    '**Vinaside - Nơi nghỉ dưỡng lý tưởng của bạn!**\n\n**Chúng tôi cung cấp:**\n- Phòng nghỉ chất lượng cao với giá tốt nhất\n- Đa dạng loại phòng: Standard, Deluxe, Suite, Villa\n- Vị trí đắc địa gần biển, trung tâm thành phố\n- Tiện nghi hiện đại: WiFi, điều hòa, TV, bếp\n- Dịch vụ 24/7 và hỗ trợ tận tâm\n\n**Địa điểm nổi bật:**\n- Đà Nẵng: Biển Mỹ Khê, Bán đảo Sơn Trà\n- Hội An: Phố cổ, Biển An Bàng\n- Ngũ Hành Sơn: Núi đá, Biển Non Nước\n\n**Ưu đãi đặc biệt:**\n- Voucher giảm giá thường xuyên\n- Ưu đãi dài ngày\n- Gói combo du lịch\n\n**Liên hệ:** 0909.123.456\n**Website:** www.vinaside.com\n\nHãy để Vinaside mang đến cho bạn kỳ nghỉ hoàn hảo!',
};

export function detectIntent(
  message: string,
):
  | keyof typeof STATIC_RESPONSES
  | 'ask_price'
  | 'check_availability_on_date'
  | 'check_availability'
  | 'check_availability_weekend'
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
  | 'check_available_rooms_by_location'
  | 'check_available_rooms_complete_info'
  | 'ask_property_info'
  | 'ask_room_amenities'
  | 'ask_payment_methods'
  | 'ask_checkin_checkout'
  | 'ask_room_capacity'
  | 'ask_room_photos'
  | 'ask_room_availability_calendar'
  | 'ask_room_location'
  | 'ask_specific_room'
  | 'ask_all_rooms'
  | 'ask_comparison'
  | 'ask_nearby_attractions'
  | 'ask_transportation'
  | 'ask_food_restaurant'
  | 'ask_weather_season'
  | 'ask_business_group'
  | 'ask_romantic_couple'
  | 'ask_accessibility'
  | 'ask_local_culture'
  | 'ask_shopping'
  | 'ask_nightlife'
  | 'ask_beach_activities'
  | 'ask_adventure'
  | 'ask_wellness'
  | 'ask_eco_friendly'
  | 'dynamic_question' {
  const msg = message.toLowerCase().trim();

  const patterns: { [key: string]: RegExp } = {
    // Existing patterns
    ask_price: /(giá|bao nhiêu|cost|price).*(phòng|room)/i,
    // Date-specific availability: capture dd/mm or dd-mm (with optional year)
    check_availability_on_date:
      /(?:đặt|book|reserve|ở|tôi muốn|muốn|^)?.*(ngày|date|vào ngày|tháng)\s*(\d{1,2}(?:[\/\-.]\d{1,2}|\s*(?:tháng|thang)\s*\d{1,2})(?:[\/\-.]\d{2,4})?)/i,
    // Mở rộng từ khóa để nhận diện ý định đặt phòng
    check_availability: /(trống|còn phòng|available|book|đặt phòng|dat phong)/i,
    check_availability_weekend: /(cuối tuần|weekend)/i,
    ask_room_count:
      /(có bao nhiêu|mấy|how many|bao nhiêu|số lượng).*(phòng|room)/i,
    ask_voucher: /(voucher|khuyến mãi|discount|promo)/i,
    greeting: /(^hi$|^xin chào$|^hello$|^chào$)/i,
    goodbye: /(tạm biệt|bye|cảm ơn|goodbye)/i,
    ask_cheapest_room: /(giá rẻ nhất|phòng rẻ nhất|cheapest room|dưới.*triệu)/i,
    ask_all_rooms:
      /(danh sách\s+(tất cả|all).*phòng|tất cả\s+các\s+phòng|danh\s+sách\s+phòng)/i,
    // Room details by name (supports multiple phrasings)
    ask_room_details:
      /((?:chi tiết|thông tin|details)\s+(?:về\s+)?(?:phòng|room)\s+([\wÀ-ỹ\s]+)|(?:xem|xem thêm|coi)\s+(?:chi tiết|details)\s+(?:phòng\s+)?([\wÀ-ỹ\s]+)|(?:phòng|room)\s+([\wÀ-ỹ\s]+)\s+(?:có gì|thế nào|chi tiết|details|thông tin))/i,
    ask_service: /(dịch vụ|service).*(có gì|available)/i,
    ask_reviews: /(đánh giá|review|rating).*(phòng|room)/i,
    'message.send': /(gán nhân viên|assign staff).*(property)/i,
    ask_family_room: /(gia đình|trẻ nhỏ|family|kids)/i,
    ask_view_room: /(view biển|sea view|ocean view)/i,
    ask_pet_policy: /(thú cưng|pet|dog|cat)/i,
    ask_long_stay_discount: /(dài ngày|long stay|nhiều đêm)/i,
    ask_event_discount: /(lễ|quốc khánh|2\/9|event|special offer)/i,
    ask_cancellation_policy: /(hủy phòng|cancel|cancellation)/i,

    // Location-based patterns
    ask_rooms_by_location:
      /((có|là).*(phòng|room).*(ở|tại|gần|near|location)|(phòng|room).*(ở|tại|gần|near|location)|(có|là).*phòng.*nào).*(đà nẵng|da nang|hà nội|ha noi|hội an|hoi an|sơn trà|son tra|ngũ hành sơn|ngu hanh son|liên chiểu|lien chieu|hải châu|hai chau|cẩm lệ|cam le|thanh khê|thanh khe|hoà vang|hoa vang|biển|bien|beach|trung tâm|trung tam|center|sân bay|san bay|airport|chợ|cho|market|bãi biển|bai bien|mỹ khê|my khe|non nước|non nuoc|bán đảo|ban dao|peninsula)/i,
    // Check available rooms by location
    check_available_rooms_by_location:
      /(hồ chí minh|ho chi minh|hcm|tp\.?hcm|sài gòn|saigon|hà nội|ha noi|hanoi|đà nẵng|da nang|ninh bình|ninh binh|đà lạt|da lat).*(còn phòng|trống|available|có phòng|phòng nào)/i,
    // Check available rooms with complete booking info (date, location, nights, guests)
    check_available_rooms_complete_info:
      /(?:tôi|mình|em|tớ).*(?:muốn|muốn đặt|đặt|book).*(?:phòng|room).*(?:ngày|date|ngày\s+\d{1,2}\/\d{1,2}).*(?:ở|tại|gần|near).*(?:hồ chí minh|ho chi minh|hcm|tp\.?hcm|sài gòn|saigon|hà nội|ha noi|hn|hanoi|đà nẵng|da nang|hội an|hoi an|ninh bình|ninh binh|nha trang|đà lạt|da lat|dalat|quảng ninh|quang ninh|tam đảo|tam dao).*(?:ở|ở lại|stay).*(?:\d+).*(?:đêm|night|nights).*(?:đi|với|cùng).*(?:\d+).*(?:người|person|people|guests)/i,
    ask_property_info:
      /(khách sạn|hotel|resort|villa|apartment|chỗ nghỉ|nơi ở).*(ở|tại|gần|near)/i,
    ask_room_location:
      /(phòng|room).*(ở chỗ nào|ở đâu|location|address|địa chỉ|ở địa điểm nào)/i,
    ask_specific_room: /(phòng|room)\s+([\w]+)\s+([^ở\s]+(?:\s+[^ở\s]+)*)/i,

    // Enhanced room query patterns
    ask_room_amenities:
      /(phòng.*(có|là).*|có.*)(tiện nghi|amenity|wifi|tủ lạnh|điều hòa|ac|tv|tivi|bếp|kitchen|máy giặt|washing|parking|bãi xe|swimming|hồ bơi|gym|phòng tập)/i,
    ask_booking_process:
      /(đặt phòng|booking|reserve|đặt|book).*(như thế nào|how|process|quy trình|thế nào)/i,
    ask_booking_steps:
      /(các bước|steps|quy trình|process).*(đặt phòng|booking|reserve|đặt|book)/i,
    ask_payment_methods:
      /(thanh toán|payment|pay).*(bằng gì|method|cách nào|momo|vnpay|tiền mặt|cash|thẻ|card)/i,
    ask_checkin_checkout:
      /(check.?in|check.?out|nhận phòng|trả phòng|giờ nhận|giờ trả|thời gian).*(mấy giờ|time|when)/i,
    ask_room_capacity:
      /(bao nhiêu người|capacity|sức chứa|max|tối đa).*(người|person|guest)/i,
    ask_room_photos: /(hình ảnh|photo|ảnh|picture|image).*(phòng|room)/i,
    ask_room_availability_calendar:
      /(lịch|calendar|ngày|date).*(trống|available|còn phòng)/i,
    ask_vinaside_info:
      /(vinaside|website|trang web).*(có gì|gì|thông tin|giới thiệu)/i,

    // NEW: Comparison and recommendation patterns
    ask_comparison:
      /(so sánh|compare|khác nhau|difference|nên chọn|recommend|tư vấn|suggest)/i,

    // NEW: Local attractions and activities
    ask_nearby_attractions:
      /(gần đây|nearby|attractions|địa điểm|tourist|du lịch|tham quan|visited|places|chỗ chơi|đi chơi)/i,
    ask_beach_activities:
      /(hoạt động|activities).*(biển|beach|bãi tắm|swimming|lặn|diving|surf)/i,
    ask_adventure:
      /(phiêu lưu|adventure|extreme|leo núi|climbing|trekking|hiking|motorbiking)/i,
    ask_wellness: /(spa|massage|thư giãn|relax|wellness|yoga|meditation)/i,

    // NEW: Transportation
    ask_transportation:
      /(di chuyển|transportation|taxi|grab|bus|xe buýt|thuê xe|rent|bike|motor|từ sân bay|airport)/i,

    // NEW: Food and dining
    ask_food_restaurant:
      /(ăn|eat|food|restaurant|quán ăn|món ăn|specialty|đặc sản|local food|street food|seafood|hải sản)/i,

    // NEW: Weather and season
    ask_weather_season:
      /(thời tiết|weather|season|mùa|nắng|mưa|rain|sunny|cold|hot|best time|thời điểm tốt)/i,

    // NEW: Business and group travel
    ask_business_group:
      /(công việc|business|meeting|conference|team building|group|nhóm|đoàn)/i,

    // NEW: Romantic and couple travel
    ask_romantic_couple:
      /(romantic|lãng mạn|couple|cặp đôi|honeymoon|tuần trăng mật|valentine)/i,

    // NEW: Accessibility
    ask_accessibility:
      /(accessibility|wheelchair|người già|elderly|disabled|khuyết tật|tiện lợi)/i,

    // NEW: Local culture and customs
    ask_local_culture:
      /(văn hóa|culture|customs|tradition|truyền thống|local|địa phương|lễ hội|festival)/i,

    // NEW: Shopping
    ask_shopping:
      /(mua sắm|shopping|chợ|market|mall|siêu thị|souvenir|quà lưu niệm)/i,

    // NEW: Nightlife
    ask_nightlife:
      /(đêm|night|nightlife|bar|club|karaoke|beer|bia|entertainment)/i,

    // NEW: Eco-friendly
    ask_eco_friendly:
      /(eco|green|environmental|môi trường|bền vững|sustainable|nature|tự nhiên)/i,
  };

  for (const [intent, pattern] of Object.entries(patterns)) {
    if (pattern.test(msg)) {
      return intent as keyof typeof STATIC_RESPONSES;
    }
  }

  // If no pattern matches, treat as dynamic question for AI
  return 'dynamic_question';
}
