import { Slots } from '../helpers/slots';

export interface ChatbotMessage {
  content: string;
  user_id?: string;
  reply?: string;
  createdAt?: Date;
}

export interface ChatbotSession {
  userId: string;
  slots: Slots;
  lastMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}
