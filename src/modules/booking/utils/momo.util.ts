import * as crypto from 'crypto';

export interface MoMoParams {
  [key: string]: string | number;
}

export class MoMoUtil {
  /**
   * Tạo signature cho MoMo request
   */
  static createSignature(rawSignature: string, secretKey: string): string {
    const hmac = crypto.createHmac('sha256', secretKey);
    return hmac.update(rawSignature).digest('hex');
  }

  /**
   * Tạo raw signature string cho MoMo
   */
  static createRawSignature(params: {
    accessKey: string;
    amount: string;
    extraData: string;
    ipnUrl: string;
    orderId: string;
    orderInfo: string;
    partnerCode: string;
    redirectUrl: string;
    requestId: string;
    requestType: string;
  }): string {
    return `accessKey=${params.accessKey}&amount=${params.amount}&extraData=${params.extraData}&ipnUrl=${params.ipnUrl}&orderId=${params.orderId}&orderInfo=${params.orderInfo}&partnerCode=${params.partnerCode}&redirectUrl=${params.redirectUrl}&requestId=${params.requestId}&requestType=${params.requestType}`;
  }

  /**
   * Xác thực signature từ MoMo callback
   */
  static verifySignature(
    params: {
      accessKey: string;
      amount: number;
      extraData: string;
      message: string;
      orderId: string;
      orderInfo: string;
      orderType: string;
      partnerCode: string;
      payType: string;
      requestId: string;
      responseTime: number;
      resultCode: number;
      transId: string;
    },
    signature: string,
    secretKey: string,
  ): boolean {
    const rawSignature = `accessKey=${params.accessKey}&amount=${params.amount}&extraData=${params.extraData}&message=${params.message}&orderId=${params.orderId}&orderInfo=${params.orderInfo}&orderType=${params.orderType}&partnerCode=${params.partnerCode}&payType=${params.payType}&requestId=${params.requestId}&responseTime=${params.responseTime}&resultCode=${params.resultCode}&transId=${params.transId}`;

    const calculatedSignature = this.createSignature(rawSignature, secretKey);
    return calculatedSignature === signature;
  }

  /**
   * Tạo unique request ID cho MoMo
   */
  static generateRequestId(): string {
    return Date.now().toString();
  }

  /**
   * Tạo order ID unique cho MoMo
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
   * Validate MoMo response code
   */
  static isSuccessResponse(resultCode: number): boolean {
    return resultCode === 0;
  }

  /**
   * Get MoMo response message
   */
  static getResponseMessage(resultCode: number): string {
    const messages: { [key: number]: string } = {
      0: 'Successful',
      9000: 'Confirmed',
      8000: 'Processing',
      7000: 'Transaction timeout',
      1000: 'Transaction initialized',
      4001: 'Amount invalid',
      4100: 'Transaction not found',
      41: 'Transaction failed',
      43: 'Payment failed',
      1005: 'Account or card locked',
      1006: 'Account not activated',
      1007: 'Exceeds transaction limit',
      4015: 'Capture failed',
      6002: 'Customer cancelled',
      7002: 'Transaction expired',
      9998: 'System maintenance',
      99: 'Unknown error',
    };

    return messages[resultCode] || 'Unknown error';
  }

  /**
   * Format số tiền cho MoMo (VND, số nguyên)
   */
  static formatAmount(amount: number): string {
    return Math.round(amount).toString();
  }

  /**
   * Parse số tiền từ MoMo callback
   */
  static parseAmount(amount: string | number): number {
    return typeof amount === 'string' ? parseInt(amount) : amount;
  }

  /**
   * Tạo extra data (có thể chứa thông tin thêm)
   */
  static createExtraData(data: Record<string, any> = {}): string {
    if (Object.keys(data).length === 0) {
      return '';
    }
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  /**
   * Parse extra data từ MoMo
   */
  static parseExtraData(extraData: string): Record<string, any> {
    if (!extraData) {
      return {};
    }
    try {
      return JSON.parse(Buffer.from(extraData, 'base64').toString()) as Record<
        string,
        any
      >;
    } catch {
      return {} as Record<string, any>;
    }
  }

  /**
   * Tạo raw signature cho refund request
   */
  static createRefundRawSignature(params: {
    accessKey: string;
    amount: string;
    description: string;
    orderId: string;
    partnerCode: string;
    requestId: string;
    transId: string;
  }): string {
    return `accessKey=${params.accessKey}&amount=${params.amount}&description=${params.description}&orderId=${params.orderId}&partnerCode=${params.partnerCode}&requestId=${params.requestId}&transId=${params.transId}`;
  }

  /**
   * Tạo raw signature cho query transaction
   */
  static createQueryRawSignature(params: {
    accessKey: string;
    orderId: string;
    partnerCode: string;
    requestId: string;
  }): string {
    return `accessKey=${params.accessKey}&orderId=${params.orderId}&partnerCode=${params.partnerCode}&requestId=${params.requestId}`;
  }

  /**
   * Validate MoMo partner code format
   */
  static isValidPartnerCode(partnerCode: string): boolean {
    return /^[A-Z0-9]+$/.test(partnerCode) && partnerCode.length > 0;
  }

  /**
   * Validate MoMo access key format
   */
  static isValidAccessKey(accessKey: string): boolean {
    return /^[A-Za-z0-9]+$/.test(accessKey) && accessKey.length > 0;
  }

  /**
   * Generate IPN response for MoMo
   */
  static createIPNResponse(success: boolean, message: string = '') {
    return {
      partnerCode: 'PARTNER_CODE', // Will be filled by service
      requestId: 'REQUEST_ID', // Will be filled by service
      orderId: 'ORDER_ID', // Will be filled by service
      resultCode: success ? 0 : 99,
      message: message || (success ? 'Successful' : 'Failed'),
      responseTime: Date.now(),
      extraData: '',
    };
  }
}
