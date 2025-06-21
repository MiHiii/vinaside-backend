import { Types } from 'mongoose';
import { toSafeString } from '../../../utils';
import {
  PopulatedMessage,
  FormattedMessage,
  FormattedReaction,
  PopulatedReaction,
  isMessageWithId,
  SocketAuthData,
} from '../interfaces/message.interface';
import { MessageStatus } from '../schemas/message.schema';

/**
 * Format reactions array để gửi qua socket
 */
export function formatReactions(
  reactions: PopulatedReaction[] = [],
): FormattedReaction[] {
  return reactions.map((reaction) => ({
    userId: reaction.user_id?._id?.toString() || '',
    username: reaction.user_id?.username || '',
    type: reaction.type,
    created_at: reaction.created_at?.toISOString() || new Date().toISOString(),
  }));
}

/**
 * Format message để gửi qua socket
 */
export function formatMessageForSocket(
  message: PopulatedMessage,
): FormattedMessage {
  return {
    content: message.content,
    senderId: message.sender_id._id.toString(),
    receiverId: message.receiver_id._id.toString(),
    sent_at: message.sent_at.toISOString(),
    is_read: message.is_read,
    reactions: formatReactions(message.reactions),
  };
}

/**
 * Lấy message ID an toàn từ message object
 */
export function extractMessageId(message: unknown): string {
  if (isMessageWithId(message)) {
    return toSafeString(message._id);
  }
  return '';
}

/**
 * Lấy userId an toàn từ socket auth data
 */
export function extractUserIdFromAuth(auth: unknown): string | null {
  if (
    auth &&
    typeof auth === 'object' &&
    'userId' in auth &&
    typeof (auth as SocketAuthData).userId === 'string'
  ) {
    return (auth as SocketAuthData).userId!;
  }
  return null;
}

/**
 * Validate ObjectId string
 */
export function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id);
}

/**
 * Chuyển đổi string thành ObjectId an toàn
 */
export function toObjectId(id: string): Types.ObjectId | null {
  try {
    if (isValidObjectId(id)) {
      return new Types.ObjectId(id);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Tạo formatted message từ CreateMessageDto và saved message để emit realtime
 */
export function createRealtimeMessage(params: {
  messageId: string;
  content: string;
  senderId: string;
  receiverId: string;
  sent_at?: Date;
  is_read: MessageStatus;
}): FormattedMessage {
  const { content, senderId, receiverId, sent_at, is_read } = params;

  return {
    content,
    senderId,
    receiverId,
    sent_at: sent_at ? sent_at.toISOString() : new Date().toISOString(),
    is_read,
  };
}

/**
 * Xử lý error message an toàn cho socket response
 */
export function handleSocketError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

/**
 * Build room name cho socket
 */
export function buildUserRoom(userId: string): string {
  return `user_${userId}`;
}

/**
 * Kiểm tra xem 2 user có trong cùng conversation không
 */
export function isInConversation(
  conversationParticipants: string[],
  userId1: string,
  userId2: string,
): boolean {
  return (
    conversationParticipants.includes(userId1) &&
    conversationParticipants.includes(userId2)
  );
}
