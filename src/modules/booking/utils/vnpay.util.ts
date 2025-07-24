import * as crypto from 'crypto';

export interface VNPayParams {
  [key: string]: string | number;
}

export class VNPayUtil {
  /**
   * Sắp xếp các tham số theo thứ tự alphabet (theo chuẩn VNPay)
   */
  static sortObject(obj: VNPayParams): VNPayParams {
    const sorted: VNPayParams = {};
    const str: string[] = [];

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        str.push(encodeURIComponent(key));
      }
    }
    str.sort();

    for (let i = 0; i < str.length; i++) {
      const originalKey = decodeURIComponent(str[i]);
      // Encode value như VNPay chuẩn
      sorted[str[i]] = encodeURIComponent(obj[originalKey]).replace(
        /%20/g,
        '+',
      );
    }

    return sorted;
  }

  /**
   * Tạo secure hash cho VNPay
   */
  static createSecureHash(params: VNPayParams, secretKey: string): string {
    const sortedParams = this.sortObject(params);
    // Tạo query string như official VNPay code
    const signData = Object.keys(sortedParams)
      .map((key) => `${key}=${sortedParams[key]}`)
      .join('&');
    const hmac = crypto.createHmac('sha512', secretKey);
    return hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
  }

  /**
   * Xác thực secure hash từ VNPay callback
   */
  static verifySecureHash(
    params: VNPayParams,
    secureHash: string,
    secretKey: string,
  ): boolean {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { vnp_SecureHash, ...otherParams } = params;
    const calculatedHash = this.createSecureHash(otherParams, secretKey);
    return calculatedHash === secureHash;
  }

  /**
   * Tạo payment URL cho VNPay
   */
  static createPaymentUrl(baseUrl: string, params: VNPayParams): string {
    const sortedParams = this.sortObject(params);
    // Tạo query string như official VNPay code
    const queryString = Object.keys(sortedParams)
      .map((key) => `${key}=${sortedParams[key]}`)
      .join('&');
    return `${baseUrl}?${queryString}`;
  }

  /**
   * Format số tiền theo yêu cầu VNPay (VND, không có dấu phẩy)
   */
  static formatAmount(amount: number): string {
    return Math.round(amount * 100).toString();
  }

  /**
   * Parse số tiền từ VNPay callback về số thực
   */
  static parseAmount(amount: string): number {
    return parseInt(amount) / 100;
  }

  /**
   * Tạo order ID unique cho VNPay
   */
  static generateOrderId(bookingId: string): string {
    const timestamp = Date.now();
    return `${bookingId}_${timestamp}`;
  }

  /**
   * Extract booking ID từ order ID
   */
  static extractBookingId(orderId: string): string {
    return orderId.split('_')[0];
  }

  /**
   * Format date theo yêu cầu VNPay (yyyyMMddHHmmss)
   */
  static formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Tạo expire time (15 phút từ hiện tại)
   */
  static getExpireTime(): string {
    const now = new Date();
    const expireTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes
    return this.formatDate(expireTime);
  }

  /**
   * Validate VNPay response code
   */
  static isSuccessResponse(responseCode: string): boolean {
    return responseCode === '00';
  }

  /**
   * Debug: Tạo chuỗi hash với logging
   */
  static createSecureHashWithDebug(
    params: VNPayParams,
    secretKey: string,
  ): { hash: string; debug: any } {
    const sortedParams = this.sortObject(params);

    // Tạo query string như official VNPay code
    const signData = Object.keys(sortedParams)
      .map((key) => `${key}=${sortedParams[key]}`)
      .join('&');

    console.log('🔍 Debug VNPay Hash:');
    console.log('Sorted Params:', sortedParams);
    console.log('Sign Data:', signData);
    console.log('Secret Key:', secretKey);

    const hmac = crypto.createHmac('sha512', secretKey);
    const hash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    console.log('Generated Hash:', hash);

    return { hash, debug: { sortedParams, signData, secretKey } };
  }

  /**
   * Get VNPay response message
   */
  static getResponseMessage(responseCode: string): string {
    const messages: { [key: string]: string } = {
      '00': 'Giao dịch thành công',
      '07': 'Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường).',
      '09': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng chưa đăng ký dịch vụ InternetBanking tại ngân hàng.',
      '10': 'Giao dịch không thành công do: Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
      '11': 'Giao dịch không thành công do: Đã hết hạn chờ thanh toán. Xin quý khách vui lòng thực hiện lại giao dịch.',
      '12': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng bị khóa.',
      '13': 'Giao dịch không thành công do Quý khách nhập sai mật khẩu xác thực giao dịch (OTP). Xin quý khách vui lòng thực hiện lại giao dịch.',
      '24': 'Giao dịch không thành công do: Khách hàng hủy giao dịch',
      '51': 'Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch.',
      '65': 'Giao dịch không thành công do: Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày.',
      '75': 'Ngân hàng thanh toán đang bảo trì.',
      '79': 'Giao dịch không thành công do: KH nhập sai mật khẩu thanh toán quá số lần quy định. Xin quý khách vui lòng thực hiện lại giao dịch',
      '99': 'Các lỗi khác (lỗi còn lại, không có trong danh sách mã lỗi đã liệt kê)',
    };

    return messages[responseCode] || 'Lỗi không xác định';
  }
}
