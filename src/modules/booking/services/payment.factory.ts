import { Injectable, BadRequestException } from '@nestjs/common';
import {
  PaymentMethod,
  PaymentProvider,
} from '../../transactions/schemas/transaction.schema';
import { PaymentServiceInterface } from '../interfaces/payment-service.interface';
import { VNPayService } from './vnpay.service';
// import { MoMoService } from './momo.service'; // Will be created later

@Injectable()
export class PaymentFactory {
  private readonly paymentServices: Map<
    PaymentMethod,
    PaymentServiceInterface
  > = new Map();

  constructor(
    private readonly vnpayService: VNPayService,
    // private readonly momoService: MoMoService, // Will be injected later
  ) {
    this.registerPaymentServices();
  }

  private registerPaymentServices(): void {
    this.paymentServices.set(PaymentMethod.VNPAY, this.vnpayService);
    // this.paymentServices.set(PaymentMethod.MOMO, this.momoService); // Will be added later
  }

  getPaymentService(paymentMethod: PaymentMethod): PaymentServiceInterface {
    const service = this.paymentServices.get(paymentMethod);

    if (!service) {
      throw new BadRequestException(
        `Payment method ${paymentMethod} is not supported`,
      );
    }

    return service;
  }

  getSupportedPaymentMethods(): PaymentMethod[] {
    return Array.from(this.paymentServices.keys());
  }

  isPaymentMethodSupported(paymentMethod: PaymentMethod): boolean {
    return this.paymentServices.has(paymentMethod);
  }

  getPaymentProvider(paymentMethod: PaymentMethod): PaymentProvider {
    const service = this.getPaymentService(paymentMethod);
    return service.getPaymentProvider();
  }
}
