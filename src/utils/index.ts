/**
 * Interface cho dữ liệu auth từ socket handshake
 */
export interface AuthData {
  userId?: string;
  [key: string]: unknown;
}

/**
 * Interface cho message có _id
 */
export interface MessageWithId {
  _id?: {
    toString: () => string;
  };
  [key: string]: unknown;
}

/**
 * Interface cho object có thuộc tính toString
 */
export interface ToStringable {
  toString: () => string;
}

/**
 * Chuyển ObjectId hoặc bất kỳ giá trị nào về dạng string an toàn
 */
export function toSafeString(id: unknown): string {
  return id && typeof (id as ToStringable).toString === 'function'
    ? (id as ToStringable).toString()
    : '';
}

/**
 * Kiểm tra và lấy userId từ auth data an toàn
 */
export function extractUserId(auth: unknown): string | null {
  if (
    auth &&
    typeof auth === 'object' &&
    'userId' in auth &&
    typeof (auth as AuthData).userId === 'string'
  ) {
    return (auth as AuthData).userId!;
  }
  return null;
}

/**
 * Lấy message ID an toàn từ message object
 */
export function extractMessageId(message: unknown): string {
  if (
    message &&
    typeof message === 'object' &&
    '_id' in message &&
    (message as MessageWithId)._id &&
    typeof (message as MessageWithId)._id!.toString === 'function'
  ) {
    return (message as MessageWithId)._id!.toString();
  }
  return '';
}

/**
 * Kiểm tra error và lấy message an toàn
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

/**
 * Type guard để kiểm tra object có field cụ thể
 */
export function hasField<T extends string>(
  obj: unknown,
  field: T,
): obj is Record<T, unknown> {
  return obj !== null && typeof obj === 'object' && field in obj;
}
