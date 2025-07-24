import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { MessagesGateway } from './messages.gateway';
import { Message, MessageSchema } from './schemas/message.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { GuestOrPermissionGuard } from '../../common/guards/guest-or-permission.guard';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Message.name, schema: MessageSchema }]),
    NotificationsModule,
    AuthModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesGateway, GuestOrPermissionGuard],
  exports: [MessagesService, MessagesGateway],
})
export class MessagesModule {}
