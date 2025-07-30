// intent-rules.ts
export const STATIC_RESPONSES = {
  ask_voucher:
    'Hiện tại chúng tôi chưa có voucher nào áp dụng. Bạn vui lòng theo dõi Fanpage để cập nhật sớm nhất!',
  greeting: 'Xin chào! Tôi có thể hỗ trợ gì cho bạn hôm nay?',
  goodbye: 'Cảm ơn bạn đã sử dụng dịch vụ. Chúc bạn một ngày tốt lành!',
  unknown: 'Tôi chưa rõ câu hỏi của bạn, bạn có thể nói cụ thể hơn không?',
  ask_cheapest_room: '', // sẽ xử lý động
};

export function detectIntent(
  message: string,
): keyof typeof STATIC_RESPONSES | 'ask_price' | 'check_availability' {
  const msg = message.toLowerCase();
  if (msg.includes('giá') || msg.includes('bao nhiêu')) return 'ask_price';
  if (msg.includes('trống') || msg.includes('còn phòng'))
    return 'check_availability';
  if (msg.includes('voucher') || msg.includes('khuyến mãi'))
    return 'ask_voucher';
  if (['hi', 'xin chào', 'hello'].some((kw) => msg.includes(kw)))
    return 'greeting';
  if (['cảm ơn', 'bye', 'tạm biệt'].some((kw) => msg.includes(kw)))
    return 'goodbye';
  if (
    msg.includes('giá rẻ nhất') ||
    msg.includes('phòng rẻ nhất') ||
    msg.includes('phòng nào rẻ nhất')
  )
    return 'ask_cheapest_room';
  return 'unknown';
}
