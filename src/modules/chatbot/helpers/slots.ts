export type Slots = {
  city?: string; // "Đà Nẵng"
  checkIn?: string; // "YYYY-MM-DD"
  checkOut?: string; // "YYYY-MM-DD"
  nights?: number; // 2
  guests?: number; // 2
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
  'ho chi minh': 'Hồ Chí Minh',
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

  // City
  for (const key of Object.keys(CITY_MAP)) {
    if (norm(t).includes(norm(key))) {
      slots.city = CITY_MAP[key];
      break;
    }
  }

  // Guests (2 người / 2 khách / adults)
  const g = t.match(/(\d+)\s*(người|nguoi|khách|khach|adult|adults)/i);
  if (g) slots.guests = Math.max(1, parseInt(g[1], 10));
  if (!slots.guests && /(cặp đôi|cap doi)/i.test(t)) slots.guests = 2;

  // Nights (2 đêm | 2 ngày)
  const n = t.match(/(\d+)\s*(đêm|dem|night|nights|ngày|day|days)/i);
  if (n) slots.nights = Math.max(1, parseInt(n[1], 10));

  // Dates: "26/8" hoặc "25/8 đến 27/8"
  const yNow = now.getFullYear();
  const rgRange =
    /(\d{1,2})[\/\-.](\d{1,2}).{0,50}(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/i;
  const rgSingle = /(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/i;

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
  }

  return slots;
}

// Hợp nhất slot: cái mới chỉ "đè" nếu có giá trị
export function mergeSlots(oldS: Slots, newS: Partial<Slots>): Slots {
  const merged: Slots = { ...oldS };
  for (const k of Object.keys(newS) as (keyof Slots)[]) {
    const v = newS[k];
    if (v !== undefined && v !== null && v !== '') merged[k] = v as any;
  }
  // Tự suy ra checkOut nếu có checkIn + nights mà chưa có checkOut
  if (merged.checkIn && merged.nights && !merged.checkOut) {
    const ci = new Date(merged.checkIn);
    merged.checkOut = toYMD(addDays(ci, merged.nights));
  }
  return merged;
}

// Chỉ trả về phần còn thiếu để HỎI-CHO-ĐÚNG
export function missingForSearch(s: Slots): string[] {
  const lacks: string[] = [];
  if (!s.city) lacks.push('khu vực'); // city
  if (!s.checkIn) lacks.push('ngày nhận phòng'); // checkIn
  if (!s.checkOut && !s.nights) lacks.push('số đêm'); // nights hoặc checkOut
  if (!s.guests) lacks.push('số khách'); // guests
  return lacks;
}

// Kiểm tra xem slots đã đủ để tìm phòng chưa
export function isCompleteForSearch(s: Slots): boolean {
  return missingForSearch(s).length === 0;
}
