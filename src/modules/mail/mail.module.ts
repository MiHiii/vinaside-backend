import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { BullModule } from '@nestjs/bull';
import {
  EmailQueueProcessor,
  EmailQueueService,
  EMAIL_QUEUE,
} from './mail.queue';

@Module({
  imports: [
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get<string>('MAIL_HOST'),
          port: config.get<number>('MAIL_PORT'),
          secure: config.get<boolean>('MAIL_SECURE', false),
          auth: {
            user: config.get<string>('MAIL_USER'),
            pass: config.get<string>('MAIL_PASSWORD'),
          },
        },
        defaults: {
          from: `"${config.get<string>('MAIL_FROM_NAME', 'Vinaside')}" <${config.get<string>(
            'MAIL_FROM_ADDRESS',
            'noreply@vinaside.com',
          )}>`,
        },
        template: {
          dir: join(__dirname, 'templates'),
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
    } as any),
    BullModule.registerQueueAsync({
      name: EMAIL_QUEUE,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
        defaultJobOptions: {
          attempts: 3,
          removeOnComplete: true,
          removeOnFail: false,
        },
      }),
    }),
  ],
  controllers: [MailController],
  providers: [MailService, EmailQueueService, EmailQueueProcessor],
  exports: [MailService, EmailQueueService],
})
export class MailModule {}
