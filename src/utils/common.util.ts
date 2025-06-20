/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Types } from 'mongoose';

/**
 * Lấy thông tin từ object dựa trên danh sách fields
 * @param fields Danh sách các trường cần lấy
 * @param object Object gốc
 * @returns Object mới chỉ chứa các trường được chỉ định
 */
export const getInfoData = <
  T extends Record<string, any>,
  K extends keyof T,
>(params: {
  fields: K[];
  object: T;
}): Pick<T, K> => {
  const { fields, object } = params;
  const result = {} as Pick<T, K>;

  fields.forEach((field) => {
    if (typeof object[field] === 'object' && object[field] !== null) {
      result[field] = object[field];
    }
  });

  return result;
};

/**
 * Loại bỏ thuộc tính undefined và null trong object
 * @param obj Object cần xử lý
 * @returns Object đã loại bỏ các thuộc tính null/undefined
 */
export const removeUndefinedObject = <T extends Record<string, any>>(
  obj: T,
): T => {
  Object.keys(obj).forEach((k) => {
    if (obj[k] == null) {
      delete obj[k];
    }
  });
  return obj;
};

/**
 * Loại bỏ các trường được chỉ định khỏi object
 * @param obj Object cần xử lý
 * @param fields Danh sách các trường cần loại bỏ
 * @returns Object mới đã loại bỏ các trường được chỉ định
 */
export const removeFields = <T extends Record<string, any>>(
  obj: T,
  fields: string[],
): Omit<T, any> => {
  const result = { ...obj };
  fields.forEach((field) => {
    delete result[field];
  });
  return result;
};

/**
 * Chuyển đổi mảng string ids thành array ObjectId của MongoDB
 * @param arr Mảng chuỗi id
 * @returns Mảng ObjectId
 */
export const convertToObjectIdMongodb = (arr: string[]): Types.ObjectId[] => {
  return arr.map((item) => new Types.ObjectId(item));
};

/**
 * Chuyển mảng các trường ['a', 'b', 'c'] thành object { a: 1, b: 1, c: 1 }
 * Dùng cho select() trong MongoDB
 * @param select Mảng các trường cần chọn
 * @returns Object theo định dạng select của MongoDB
 */
export const getSelectData = (select: string[] = []): Record<string, 1> => {
  return Object.fromEntries(select.map((item) => [item, 1])) as Record<
    string,
    1
  >;
};

/**
 * Chuyển mảng các trường ['a', 'b', 'c'] thành object { a: 0, b: 0, c: 0 }
 * Dùng cho select() trong MongoDB
 * @param select Mảng các trường cần loại trừ
 * @returns Object theo định dạng unselect của MongoDB
 */
export const getUnSelectData = (select: string[] = []): Record<string, 0> => {
  return Object.fromEntries(select.map((item) => [item, 0])) as Record<
    string,
    0
  >;
};

/**
 * Parse nested object để update
 * @param obj Object cần parse
 * @returns Object đã parse theo format của MongoDB update
 */
export const updateNestedObjectParser = (
  obj: Record<string, any>,
): Record<string, any> => {
  const final: Record<string, any> = {};

  for (const k of Object.keys(obj)) {
    const value = obj[k];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const response = updateNestedObjectParser(value);
      for (const a of Object.keys(response)) {
        final[`${k}.${a}`] = response[a];
      }
    } else {
      final[k] = value;
    }
  }

  return final;
};

/**
 * Chuyển đổi ID thành chuỗi an toàn
 */
export function toSafeString(id: any): string {
  if (!id) return '';

  // Nếu là ObjectId
  if (id instanceof Types.ObjectId) {
    return id.toString();
  }

  // Nếu là chuỗi
  if (typeof id === 'string') {
    return id;
  }

  // Trường hợp khác
  return String(id);
}

/**
 * Xây dựng bộ lọc tìm kiếm theo từ khóa
 */
export function buildSearchFilter(
  keyword: string,
  fields: string[],
): Array<Record<string, any>> {
  const regex = { $regex: keyword, $options: 'i' };
  return fields.map((field) => ({ [field]: regex }));
}

/**
 * Chuyển đổi chuỗi sắp xếp thành object
 * Format: 'field:desc' hoặc 'field:asc'
 */
export function parseSortString(sortString?: string): Record<string, 1 | -1> {
  if (!sortString) {
    return { createdAt: -1 };
  }

  const result: Record<string, 1 | -1> = {};

  sortString.split(',').forEach((item) => {
    const [field, order] = item.trim().split(':');
    if (field) {
      result[field] = order?.toLowerCase() === 'desc' ? -1 : 1;
    }
  });

  return Object.keys(result).length ? result : { createdAt: -1 };
}
