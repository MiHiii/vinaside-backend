import {
  PaymentMethod,
  PaymentProvider,
} from '../../transactions/schemas/transaction.schema';

export interface PaymentResponse {
  success: boolean;
  paymentMethod: PaymentMethod;
  paymentUrl?: string;
  orderId: string;
  amount: number;
  transactionId?: string;
  message: string;
  expiresAt?: Date;
  createdAt: Date;
}

export interface PaymentVerificationResult {
  success: boolean;
  paymentMethod: PaymentMethod;
  bookingId: string;
  orderId: string;
  amount: number;
  transactionId: string;
  gatewayTransactionId?: string;
  paidAt?: Date;
  message: string;
  metadata?: Record<string, any>;
}

export interface CreatePaymentRequest {
  bookingId: string;
  paymentMethod: PaymentMethod;
  amount: number;
  description?: string;
  returnUrl?: string; // Optional - will use default if not provided
  notifyUrl?: string; // Optional - will use default if not provided
  metadata?: Record<string, any>;
}

export abstract class PaymentServiceInterface {
  abstract getPaymentMethod(): PaymentMethod;
  abstract getPaymentProvider(): PaymentProvider;

  abstract createPaymentUrl(
    request: CreatePaymentRequest,
  ): Promise<PaymentResponse>;

  abstract handleCallback(
    callbackData: any,
  ): Promise<PaymentVerificationResult>;

  abstract handleIPN(
    ipnData: any,
  ): Promise<{ success: boolean; message: string }>;

  abstract getPaymentStatus(
    orderId: string,
  ): Promise<PaymentVerificationResult>;

  abstract isValidSignature(data: any, signature: string): boolean;

  // Optional methods for refund support
  refundPayment?(
    orderId: string,
    amount: number,
    reason: string,
  ): Promise<{
    success: boolean;
    refundId: string;
    message: string;
  }>;

  // Optional method for payment inquiry
  queryPayment?(orderId: string): Promise<PaymentVerificationResult>;
}
