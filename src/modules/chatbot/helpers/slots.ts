export type Slots = {
  city?: string; // "Đà Nẵng"
  checkIn?: string; // "YYYY-MM-DD"
  checkOut?: string; // "YYYY-MM-DD"
  nights?: number; // 2
  guests?: number; // 2
  roomName?: string; // "Phòng Nắng Ấm"
};

const pad2 = (n: number) => n.toString().padStart(2, '0');
const toYMD = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const addDays = (d: Date, days: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

// Chuẩn hoá & map city (bổ sung Đà Nẵng + biến thể)
const CITY_MAP: Record<string, string> = {
  'đà nẵng': 'Đà Nẵng',
  'da nang': 'Đà Nẵng',
  danang: 'Đà Nẵng',
  'hà nội': 'Hà Nội',
  'ha noi': 'Hà Nội',
  hanoi: 'Hà Nội',
  hn: 'Hà Nội',
  'hồ chí minh': 'Hồ Chí Minh',
  'hồ chính minh': 'Hồ Chí Minh', // Fix for user typo
  'ho chi minh': 'Hồ Chí Minh',
  'ho chinh minh': 'Hồ Chí Minh', // Fix for user typo
  hcm: 'Hồ Chí Minh',
  'sài gòn': 'Hồ Chí Minh',
  'sai gon': 'Hồ Chí Minh',
  sg: 'Hồ Chí Minh',
  'hội an': 'Hội An',
  'hoi an': 'Hội An',
  'ninh bình': 'Ninh Bình',
  'ninh binh': 'Ninh Bình',
  'nha trang': 'Nha Trang',
  'đà lạt': 'Đà Lạt',
  'da lat': 'Đà Lạt',
  dalat: 'Đà Lạt',
  'quảng ninh': 'Quảng Ninh',
  'quang ninh': 'Quảng Ninh',
  'tam đảo': 'Tam Đảo',
  'tam dao': 'Tam Đảo',
};

const norm = (s = '') =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export function extractSlotsFromText(
  text: string,
  now = new Date(),
): Partial<Slots> {
  const t = text.toLowerCase();

  const slots: Partial<Slots> = {};

  // City - improved extraction with better matching
  const normalizedText = norm(t);
  for (const key of Object.keys(CITY_MAP)) {
    const normalizedKey = norm(key);
    if (normalizedText.includes(normalizedKey)) {
      slots.city = CITY_MAP[key];
      console.log(`[DEBUG] Extracted city: ${slots.city} from key: ${key}`);
      break;
    }
  }

  // Additional city detection for common variations
  if (!slots.city) {
    if (/(?:hồ|ho)\s*(?:chí|chi|chính|chinh)\s*(?:minh)/i.test(t)) {
      slots.city = 'Hồ Chí Minh';
      console.log(`[DEBUG] Extracted city via regex: ${slots.city}`);
    } else if (/(?:hà|ha)\s*(?:nội|noi)/i.test(t)) {
      slots.city = 'Hà Nội';
      console.log(`[DEBUG] Extracted city via regex: ${slots.city}`);
    } else if (/(?:đà|da)\s*(?:nẵng|nang)/i.test(t)) {
      slots.city = 'Đà Nẵng';
      console.log(`[DEBUG] Extracted city via regex: ${slots.city}`);
    }
  }

  // Guests (2 người / 2 khách / adults)
  const g = t.match(/(\d+)\s*(người|nguoi|khách|khach|adult|adults)/i);
  if (g) {
    slots.guests = Math.max(1, parseInt(g[1], 10));
  }
  if (!slots.guests && /(cặp đôi|cap doi)/i.test(t)) {
    slots.guests = 2;
  }

  // Nights (2 đêm | 2 ngày)
  const n = t.match(/(\d+)\s*(đêm|dem|night|nights|ngày|day|days)/i);
  if (n) {
    slots.nights = Math.max(1, parseInt(n[1], 10));
  }

  // Room name extraction for detail requests
  const roomMatch = t.match(
    /(?:chi tiết|thông tin|details)\s+(?:về\s+)?(?:phòng|room)\s+([\wÀ-ỹ\s]+)/i,
  );
  if (roomMatch) {
    slots.roomName = roomMatch[1].trim();
  }

  // Enhanced date extraction with better patterns
  const yNow = now.getFullYear();

  // Pattern for date ranges: "25/8 đến 27/8" or "25/8-27/8"
  const rgRange =
    /(\d{1,2})[/\-.](\d{1,2})(?:\s*(?:đến|to|-)\s*)(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?/i;

  // Pattern for single dates: "27/8" or "ngày 27/8" - improved to catch more variations
  const rgSingle = /(?:ngày\s+)?(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?/i;

  // Additional pattern for dates without separators or with different formats
  const rgSingleAlt =
    /(?:ngày\s+)?(\d{1,2})\s*(?:tháng|thang)\s*(\d{1,2})(?:\s*năm\s*(\d{2,4}))?/i;

  if (rgRange.test(t)) {
    const m = t.match(rgRange)!;
    const d1 = +m[1],
      mo1 = +m[2],
      d2 = +m[3],
      mo2 = +m[4];
    const y = m[5] ? (+m[5] < 100 ? 2000 + +m[5] : +m[5]) : yNow;
    const ci = new Date(y, mo1 - 1, d1);
    const co = new Date(y, mo2 - 1, d2);
    if (co > ci) {
      slots.checkIn = toYMD(ci);
      slots.checkOut = toYMD(co);
      slots.nights = Math.round((+co - +ci) / 86400000);
    }
  } else if (rgSingle.test(t)) {
    const m = t.match(rgSingle)!;
    const d = +m[1],
      mo = +m[2];
    const y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : yNow;
    const ci = new Date(y, mo - 1, d);
    slots.checkIn = toYMD(ci);
  } else if (rgSingleAlt.test(t)) {
    const m = t.match(rgSingleAlt)!;
    const d = +m[1],
      mo = +m[2];
    const y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : yNow;
    const ci = new Date(y, mo - 1, d);
    slots.checkIn = toYMD(ci);
  }

  return slots;
}

// Check if message contains room detail keywords
export function isRoomDetailRequest(message: string): boolean {
  const t = message.toLowerCase();
  return /(?:chi tiết|thông tin|details)\s+(?:về\s+)?(?:phòng|room)/i.test(t);
}

// Check if message is asking about general information (not room-specific)
export function isGeneralInfoRequest(message: string): boolean {
  const t = message.toLowerCase();

  // Exclude specific request types that have their own handlers
  if (
    isPaymentMethodsRequest(message) ||
    isServiceRequest(message) ||
    isVoucherRequest(message) ||
    isCancellationPolicyRequest(message) ||
    isBookingProcessRequest(message)
  ) {
    return false;
  }

  return (
    /(?:quy trình|quy chình|process|procedure)/i.test(t) ||
    /(?:dịch vụ|service|amenity)/i.test(t) ||
    /(?:thanh toán|payment|pay)/i.test(t) ||
    /(?:checkin|checkout|check-in|check-out)/i.test(t) ||
    /(?:chính sách|policy)/i.test(t) ||
    /(?:giá|price|cost)/i.test(t) ||
    /(?:đánh giá|review|rating)/i.test(t) ||
    /(?:địa điểm|location|place)/i.test(t) ||
    /(?:thời gian|time|hour)/i.test(t) ||
    /(?:cách|how|làm sao)/i.test(t) ||
    /(?:bao nhiêu|how much|how many)/i.test(t) ||
    /(?:có gì|what|gì)/i.test(t)
  );
}

// Check if message is asking about services specifically
export function isServiceRequest(message: string): boolean {
  const t = message.toLowerCase();
  return (
    /(?:dịch vụ|service|amenity)/i.test(t) ||
    /(?:massage|spa|laundry|cleaning|transport)/i.test(t) ||
    /(?:đưa đón|pickup|shuttle)/i.test(t) ||
    /(?:giặt ủi|washing|ironing)/i.test(t) ||
    /(?:dọn phòng|cleaning|housekeeping)/i.test(t)
  );
}

// Check if message is asking about vouchers specifically
export function isVoucherRequest(message: string): boolean {
  const t = message.toLowerCase();
  return (
    /(?:voucher|mã giảm|discount|ưu đãi|promotion)/i.test(t) ||
    /(?:giảm giá|sale|deal)/i.test(t) ||
    /(?:khuyến mãi|promotion|offer)/i.test(t) ||
    /(?:coupon|code|mã)/i.test(t)
  );
}

// Check if message is asking about payment methods specifically
export function isPaymentMethodsRequest(message: string): boolean {
  const t = message.toLowerCase();
  return (
    /(?:thanh toán|payment|pay).*(?:như nào|how|method|cách nào|bằng gì)/i.test(
      t,
    ) ||
    /(?:hình thức|method).*(?:thanh toán|payment)/i.test(t) ||
    /(?:thanh toán|payment).*(?:hình thức|method)/i.test(t)
  );
}

// Check if message is asking about booking process specifically
export function isBookingProcessRequest(message: string): boolean {
  const t = message.toLowerCase();
  return (
    /(?:quy trình|quy chình|process|procedure).*(?:đặt phòng|booking|book)/i.test(
      t,
    ) ||
    /(?:đặt phòng|booking|book).*(?:như nào|how|cách nào|process|procedure)/i.test(
      t,
    ) ||
    /(?:quy trình|quy chình).*(?:như nào|how|cách nào)/i.test(t)
  );
}

// Check if message is asking about cancellation policy specifically
export function isCancellationPolicyRequest(message: string): boolean {
  const t = message.toLowerCase();
  return (
    /(?:chính sách hủy|chính sách cancel|cancellation policy)/i.test(t) ||
    /(?:hủy phòng|cancel room|refund policy)/i.test(t) ||
    /(?:hoàn tiền|refund|mất phí)/i.test(t) ||
    /(?:hủy trước|cancel before)/i.test(t)
  );
}

// Check if message is a topic change that should clear all context
export function isTopicChange(message: string): boolean {
  const t = message.toLowerCase();
  return (
    /^(xin chào|hello|hi|chào)/i.test(t) ||
    /^(tôi muốn|i want|i need)/i.test(t) ||
    /^(giúp|help|assist)/i.test(t) ||
    /^(cảm ơn|thank)/i.test(t) ||
    /^(tạm biệt|goodbye|bye)/i.test(t) ||
    /^(khác|other|else)/i.test(t) ||
    /^(chuyển|switch|change)/i.test(t)
  );
}

// Check if message is a new search request (different from room detail)
export function isNewSearchRequest(message: string): boolean {
  const t = message.toLowerCase();
  return (
    /(?:tìm|tìm kiếm|search|find)\s+(?:phòng|room)/i.test(t) ||
    /(?:có|available|availability)\s+(?:phòng|room)/i.test(t) ||
    /(?:ngày|date|checkin|checkout)/i.test(t) ||
    /(?:ở|tại|in|at)\s+[a-zà-ỹ\s]+/i.test(t) ||
    /(?:bao nhiêu|how many|count)/i.test(t)
  );
}

// Check if message is a general greeting or new conversation starter
export function isNewConversation(message: string): boolean {
  const t = message.toLowerCase();
  return (
    /^(hi|hello|xin chào|chào|hôm nay|today)/i.test(t) ||
    /^(tôi muốn|i want|i need)/i.test(t) ||
    /^(giúp|help|assist)/i.test(t)
  );
}

// Check if session is too old (more than 30 minutes)
export function isSessionExpired(session: {
  updatedAt?: string | Date;
}): boolean {
  if (!session || !session.updatedAt) return true;

  const lastUpdate = new Date(session.updatedAt);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);

  return diffMinutes > 30; // 30 minutes timeout
}

// Hợp nhất slot: cái mới chỉ "đè" nếu có giá trị
export function mergeSlots(
  oldS: Slots,
  newS: Partial<Slots>,
  message?: string,
): Slots {
  console.log(
    `[DEBUG] Merging slots - Old:`,
    oldS,
    `New:`,
    newS,
    `Message:`,
    message,
  );

  const merged: Slots = { ...oldS };

  // If this is a new conversation or topic change, clear all context except basic user info
  if (message && (isNewConversation(message) || isTopicChange(message))) {
    console.log(
      `[DEBUG] New conversation/topic change detected, clearing all context`,
    );
    return { ...newS } as Slots; // Start fresh with new slots only
  }

  // Clear roomName if new context doesn't include room detail request
  // This prevents room detail context from persisting when user asks other questions
  if (!newS.roomName && oldS.roomName && message) {
    const isRoomDetail = isRoomDetailRequest(message);
    const isNewSearch = isNewSearchRequest(message);
    const isGeneralInfo = isGeneralInfoRequest(message);

    // Clear roomName if:
    // 1. Not a room detail request AND
    // 2. Is a new search request OR general info request OR has new search-related slots
    if (
      !isRoomDetail &&
      (isNewSearch ||
        isGeneralInfo ||
        newS.city ||
        newS.checkIn ||
        newS.guests ||
        newS.nights)
    ) {
      console.log(
        `[DEBUG] Clearing roomName context: "${oldS.roomName}" because new message is not a room detail request (isGeneralInfo: ${isGeneralInfo}, isNewSearch: ${isNewSearch})`,
      );
      delete merged.roomName;
    }
  }

  // For general info requests, clear search-related context to avoid confusion
  if (message && isGeneralInfoRequest(message)) {
    console.log(
      `[DEBUG] General info request detected, clearing search context`,
    );
    delete merged.city;
    delete merged.checkIn;
    delete merged.checkOut;
    delete merged.guests;
    delete merged.nights;
  }

  for (const k of Object.keys(newS) as (keyof Slots)[]) {
    const v = newS[k];
    if (v !== undefined && v !== null && v !== '')
      (merged as Record<string, unknown>)[k] = v;
  }

  // Tự suy ra checkOut nếu có checkIn + nights mà chưa có checkOut
  if (merged.checkIn && merged.nights && !merged.checkOut) {
    const ci = new Date(merged.checkIn);
    merged.checkOut = toYMD(addDays(ci, merged.nights));
  }

  console.log(`[DEBUG] Final merged slots:`, merged);
  return merged;
}

// Generate contextual questions based on what's missing
export function generateContextualQuestion(s: Slots, lacks: string[]): string {
  const hasCity = !!s.city;
  const hasCheckIn = !!s.checkIn;
  const hasGuests = !!s.guests;
  const hasNights = !!s.nights;

  // If we have most information, ask for the specific missing piece
  if (lacks.length === 1) {
    const missing = lacks[0];
    switch (missing) {
      case 'khu vực':
        return 'Bạn muốn tìm phòng ở đâu ạ?';
      case 'ngày nhận phòng':
        return 'Bạn muốn nhận phòng ngày nào ạ?';
      case 'số đêm':
        return 'Bạn định ở mấy đêm ạ?';
      case 'số khách':
        return 'Có bao nhiêu người ạ?';
      default:
        return `Bạn cho mình biết ${missing} ạ?`;
    }
  }

  // If we have some information, provide context
  if (hasCity && hasCheckIn) {
    if (!hasGuests && !hasNights) {
      return `Tìm phòng ở ${s.city} ngày ${formatDateForDisplay(s.checkIn!)}. Bạn cho mình biết có bao nhiêu người và ở mấy đêm ạ?`;
    }
    if (!hasGuests) {
      return `Tìm phòng ở ${s.city} ngày ${formatDateForDisplay(s.checkIn!)} (${s.nights} đêm). Có bao nhiêu người ạ?`;
    }
    if (!hasNights) {
      return `Tìm phòng ở ${s.city} ngày ${formatDateForDisplay(s.checkIn!)} cho ${s.guests} người. Bạn định ở mấy đêm ạ?`;
    }
  }

  if (hasCity && !hasCheckIn) {
    if (hasGuests && hasNights) {
      return `Tìm phòng ở ${s.city} cho ${s.guests} người (${s.nights} đêm). Bạn muốn nhận phòng ngày nào ạ?`;
    }
    if (hasGuests) {
      return `Tìm phòng ở ${s.city} cho ${s.guests} người. Bạn cho mình biết ngày nhận phòng và số đêm ạ?`;
    }
  }

  // Default fallback
  return (
    'Để mình tìm phòng nhanh, bạn cho mình thêm: ' + lacks.join(', ') + ' ạ?'
  );
}

// Format date for display
export function formatDateForDisplay(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return 'ngày không hợp lệ';
    }
    return `${date.getDate()}/${date.getMonth() + 1}`;
  } catch {
    return 'ngày không hợp lệ';
  }
}

// Chỉ trả về phần còn thiếu để HỎI-CHO-ĐÚNG
export function missingForSearch(s: Slots, message?: string): string[] {
  console.log(`[DEBUG] missingForSearch - Slots:`, s, `Message:`, message);

  const lacks: string[] = [];

  // If asking for room details, don't require other slots
  if (s.roomName) {
    console.log(`[DEBUG] Room detail request, no missing slots`);
    return lacks; // Room detail requests are complete
  }

  // If asking for general info, don't require search slots
  if (message && isGeneralInfoRequest(message)) {
    console.log(`[DEBUG] General info request, no missing slots`);
    return lacks; // General info requests are complete
  }

  if (!s.city) lacks.push('khu vực'); // city
  if (!s.checkIn) lacks.push('ngày nhận phòng'); // checkIn
  if (!s.checkOut && !s.nights) lacks.push('số đêm'); // nights hoặc checkOut
  if (!s.guests) lacks.push('số khách'); // guests

  console.log(`[DEBUG] Missing slots:`, lacks);
  return lacks;
}

// Kiểm tra xem slots đã đủ để tìm phòng chưa
export function isCompleteForSearch(s: Slots): boolean {
  return missingForSearch(s).length === 0;
}

// Build structured ask response based on missing slots
export function buildAsk(
  slots: Slots,
  lacks: string[],
): {
  type: 'text';
  text: string;
  meta?: {
    city?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: number;
    nights?: number;
  };
} {
  const question = generateContextualQuestion(slots, lacks);

  return {
    type: 'text',
    text: question,
    meta: {
      city: slots.city,
      checkIn: slots.checkIn,
      checkOut: slots.checkOut,
      guests: slots.guests,
      nights: slots.nights,
    },
  };
}
