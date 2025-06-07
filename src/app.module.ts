import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BookingModule } from './modules/booking/booking.module';
import { MongooseConfigModule } from './database/mongoose.providers';
import { LoggerMiddleware } from './middlewares/logger.middleware';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { MailModule } from './modules/mail/mail.module';
import { BullModule } from '@nestjs/bull';
import { redisConfigFactory } from './configs/redis.config';
import { RedisModule } from '@nestjs-modules/ioredis';
import { HouseRulesModule } from './modules/house-rules/house-rules.module';
import { UploadModule } from './modules/upload/upload.module';
import { ListingModule } from './modules/listing/listing.module';
import { AmenitiesModule } from './modules/amenities/amenities.module';
import { SafetyFeaturesModule } from './modules/safety_features/safety_features.module';

@Module({
  imports: [
    MongooseConfigModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: redisConfigFactory(configService),
      }),
    }),

    RedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'single',
        url: `redis://${configService.get('REDIS_HOST', 'localhost')}:${configService.get('REDIS_PORT', 6379)}`,
      }),
    }),
    UsersModule,
    AuthModule,
    BookingModule,
    MailModule,
    HouseRulesModule,
    UploadModule,
    ListingModule,
    AmenitiesModule,
    SafetyFeaturesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
