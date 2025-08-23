import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ChatbotController } from './chatbot.controller';
import { AIChatbotService } from './ai-chatbot.service';
import { ChatbotGateway } from './chatbot.gateway';
import {
  ChatbotMessage,
  ChatbotMessageSchema,
} from './schemas/chatbot-message.schema';
import chatbotConfig from '../../configs/chatbot.config';
import { redisConfigFactory } from '../../configs/redis.config';
import { ListingModule } from '../listing/listing.module';

@Module({
  imports: [
    ConfigModule.forFeature(chatbotConfig),
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'single',
        options: redisConfigFactory(cfg),
      }),
    }),
    MongooseModule.forFeature([
      { name: ChatbotMessage.name, schema: ChatbotMessageSchema },
    ]),
    ListingModule,
  ],
  controllers: [ChatbotController],
  providers: [AIChatbotService, ChatbotGateway],
  exports: [AIChatbotService],
})
export class ChatbotModule {}
