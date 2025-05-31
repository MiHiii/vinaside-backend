/**
 * Chuyển ObjectId hoặc bất kỳ giá trị nào về dạng string an toàn
 */
export function toSafeString(id: unknown): string {
  return id && typeof (id as { toString: () => string }).toString === 'function'
    ? (id as { toString: () => string }).toString()
    : '';
}
