import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import { MailService } from './mail.service';
import { ReservationData } from './interfaces/reservation-data.interface';

export interface EmailJob {
  to: string;
  subject: string;
  template: string;
  context: Record<string, any>;
}

export interface VerificationEmailJob {
  email: string;
  token: string;
  otp: string;
}

export interface ResetPasswordEmailJob {
  email: string;
  token: string;
}

export interface ReservationConfirmationJob {
  email: string;
  reservationData: ReservationData;
}

export interface HostNotificationJob {
  hostEmail: string;
  reservationData: ReservationData;
}

export const EMAIL_QUEUE = 'email';

@Injectable()
export class EmailQueueService {
  private readonly logger = new Logger(EmailQueueService.name);

  constructor(@InjectQueue(EMAIL_QUEUE) private emailQueue: Queue) {
    this.emailQueue.on('error', (err) => {
      console.error('❌ Redis Queue Error:', err);
    });
  }

  async addVerificationEmail(job: VerificationEmailJob): Promise<void> {
    await this.emailQueue.add('verification-email', job, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
    this.logger.log(`Added verification email job for: ${job.email}`);
  }

  async addResetPasswordEmail(job: ResetPasswordEmailJob): Promise<void> {
    await this.emailQueue.add('reset-password', job, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
    this.logger.log(`Added reset password email job for: ${job.email}`);
  }

  async addReservationConfirmation(
    job: ReservationConfirmationJob,
  ): Promise<void> {
    await this.emailQueue.add('reservation-confirmation', job, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
    this.logger.log(
      `Added reservation confirmation email job for: ${job.email}`,
    );
  }

  async addHostNotification(job: HostNotificationJob): Promise<void> {
    await this.emailQueue.add('host-notification', job, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
    this.logger.log(`Added host notification email job for: ${job.hostEmail}`);
  }

  async addGenericEmail(job: EmailJob): Promise<void> {
    await this.emailQueue.add('generic-email', job, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
    this.logger.log(`Added generic email job for: ${job.to}`);
  }
}

@Processor(EMAIL_QUEUE)
export class EmailQueueProcessor {
  private readonly logger = new Logger(EmailQueueProcessor.name);

  constructor(private mailService: MailService) {}

  @Process('verification-email')
  async processVerificationEmail(job: {
    data: VerificationEmailJob;
  }): Promise<void> {
    this.logger.log(`Processing verification email job for: ${job.data.email}`);

    try {
      await this.mailService.sendVerificationEmail(
        job.data.email,
        job.data.token,
        job.data.otp,
      );
      this.logger.log(`Verification email sent to: ${job.data.email}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to send verification email to ${job.data.email}: ${errorMessage}`,
      );
      throw error;
    }
  }

  @Process('reset-password')
  async processResetPasswordEmail(job: {
    data: ResetPasswordEmailJob;
  }): Promise<void> {
    this.logger.log(
      `Processing reset password email job for: ${job.data.email}`,
    );

    try {
      await this.mailService.sendResetPasswordEmail(
        job.data.email,
        job.data.token,
      );
      this.logger.log(`Reset password email sent to: ${job.data.email}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to send reset password email to ${job.data.email}: ${errorMessage}`,
      );
      throw error;
    }
  }

  @Process('reservation-confirmation')
  async processReservationConfirmation(job: {
    data: ReservationConfirmationJob;
  }): Promise<void> {
    this.logger.log(
      `Processing reservation confirmation email job for: ${job.data.email}`,
    );

    try {
      await this.mailService.sendReservationConfirmation(
        job.data.email,
        job.data.reservationData,
      );
      this.logger.log(
        `Reservation confirmation email sent to: ${job.data.email}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to send reservation confirmation email to ${job.data.email}: ${errorMessage}`,
      );
      throw error;
    }
  }

  @Process('host-notification')
  async processHostNotification(job: {
    data: HostNotificationJob;
  }): Promise<void> {
    this.logger.log(
      `Processing host notification email job for: ${job.data.hostEmail}`,
    );

    try {
      await this.mailService.sendHostReservationNotification(
        job.data.hostEmail,
        job.data.reservationData,
      );
      this.logger.log(`Host notification email sent to: ${job.data.hostEmail}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to send host notification email to ${job.data.hostEmail}: ${errorMessage}`,
      );
      throw error;
    }
  }

  @Process('generic-email')
  async processGenericEmail(job: { data: EmailJob }): Promise<void> {
    this.logger.log(`Processing generic email job for: ${job.data.to}`);

    try {
      await this.mailService.sendEmail(
        job.data.to,
        job.data.subject,
        job.data.template,
        job.data.context,
      );
      this.logger.log(`Generic email sent to: ${job.data.to}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to send generic email to ${job.data.to}: ${errorMessage}`,
      );
      throw error;
    }
  }
}
