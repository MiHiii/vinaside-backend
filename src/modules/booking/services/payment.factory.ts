import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import {
  PaymentMethod,
  PaymentProvider,
} from '../../transactions/schemas/transaction.schema';
import { PaymentServiceInterface } from '../interfaces/payment-service.interface';
import { VNPayService } from './vnpay.service';
// import { MoMoService } from './momo.service'; // Will be created later

@Injectable()
export class PaymentFactory {
  private readonly logger = new Logger(PaymentFactory.name);
  private readonly paymentServices: Map<
    PaymentMethod,
    PaymentServiceInterface
  > = new Map();

  constructor(
    private readonly vnpayService: VNPayService,
    // private readonly momoService: MoMoService, // Will be injected later
  ) {
    this.logger.log('Initializing PaymentFactory...');
    this.registerPaymentServices();
  }

  private registerPaymentServices(): void {
    this.logger.log('Registering VNPayService...');
    this.paymentServices.set(PaymentMethod.VNPAY, this.vnpayService);
    // this.logger.log('Registering MoMoService...');
    // this.paymentServices.set(PaymentMethod.MOMO, this.momoService); // Will be added later
  }

  getPaymentService(paymentMethod: PaymentMethod): PaymentServiceInterface {
    this.logger.log(`Getting payment service for method: ${paymentMethod}`);
    const service = this.paymentServices.get(paymentMethod);

    if (!service) {
      this.logger.error(`Payment method ${paymentMethod} is not supported`);
      throw new BadRequestException(
        `Payment method ${paymentMethod} is not supported`,
      );
    }

    return service;
  }

  getSupportedPaymentMethods(): PaymentMethod[] {
    this.logger.log('Getting supported payment methods...');
    return Array.from(this.paymentServices.keys());
  }

  isPaymentMethodSupported(paymentMethod: PaymentMethod): boolean {
    const supported = this.paymentServices.has(paymentMethod);
    this.logger.log(
      `Check if payment method ${paymentMethod} is supported: ${supported}`,
    );
    return supported;
  }

  getPaymentProvider(paymentMethod: PaymentMethod): PaymentProvider {
    this.logger.log(`Getting payment provider for method: ${paymentMethod}`);
    const service = this.getPaymentService(paymentMethod);
    return service.getPaymentProvider();
  }
}
