import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { ChatbotGateway } from './chatbot.gateway';
import {
  ChatbotMessage,
  ChatbotMessageSchema,
} from './schemas/chatbot-message.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatbotMessage.name, schema: ChatbotMessageSchema },
    ]),
  ],
  controllers: [ChatbotController],
  providers: [ChatbotService, ChatbotGateway],
})
export class ChatbotModule {}
