import { MessageStatus } from '../schemas/message.schema';

export class MessageResponseDto {
  _id: string;
  sender_id: {
    _id: string;
    username: string;
    email: string;
    avatar?: string;
  };
  receiver_id: {
    _id: string;
    username: string;
    email: string;
    avatar?: string;
  };
  content: string;
  sent_at: Date;
  is_read: MessageStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class ConversationDto {
  user: {
    _id: string;
    username: string;
    email: string;
    avatar?: string;
  };
  lastMessage: MessageResponseDto;
  unreadCount: number;
} 