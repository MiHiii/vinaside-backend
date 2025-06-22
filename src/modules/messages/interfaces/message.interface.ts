import { Types } from 'mongoose';
import { MessageStatus, ReactionType } from '../schemas/message.schema';

/**
 * Interface cho User được populate trong message
 */
export interface PopulatedUser {
  _id: Types.ObjectId;
  username: string;
  email: string;
  avatar?: string;
}

/**
 * Interface cho Message với populated fields
 */
export interface PopulatedMessage {
  _id: string;
  sender_id: {
    _id: string;
    username: string;
    email: string;
  };
  receiver_id: {
    _id: string;
    username: string;
    email: string;
  };
  content: string;
  sent_at: Date;
  is_read: MessageStatus;
  reactions: PopulatedReaction[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface cho Message formatted để gửi qua socket
 */
export interface FormattedMessage {
  content: string;
  senderId: string;
  receiverId: string;
  sent_at: string;
  is_read: MessageStatus;
  reactions?: FormattedReaction[];
}

/**
 * Interface cho Connected User trong Gateway
 */
export interface ConnectedUser {
  userId: string;
  socketId: string;
}

/**
 * Interface cho Socket Auth Data
 */
export interface SocketAuthData {
  userId?: string;
  user?: {
    _id: string;
    username: string;
    email: string;
  };
}

/**
 * Interface cho Join Room Data
 */
export interface JoinRoomData {
  userId: string;
}

/**
 * Interface cho Socket Response
 */
export interface SocketResponse<T = any> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

/**
 * Interface cho Conversation
 */
export interface Conversation {
  user: PopulatedUser;
  lastMessage: PopulatedMessage;
  unreadCount: number;
}

/**
 * Type guard để kiểm tra xem object có phải là Message với _id không
 */
export function isMessageWithId(obj: unknown): obj is { _id: Types.ObjectId } {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    '_id' in obj &&
    ((obj as { _id: unknown })._id instanceof Types.ObjectId ||
      (typeof (obj as { _id: unknown })._id === 'string' &&
        Types.ObjectId.isValid((obj as { _id: unknown })._id as string)))
  );
}

/**
 * Type guard để kiểm tra PopulatedMessage
 */
export function isPopulatedMessage(obj: unknown): obj is PopulatedMessage {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    '_id' in obj &&
    'sender_id' in obj &&
    'receiver_id' in obj &&
    'content' in obj &&
    typeof (obj as PopulatedMessage).content === 'string'
  );
}

export interface PopulatedReaction {
  user_id: {
    _id: string;
    username: string;
    email: string;
  };
  type: ReactionType;
  created_at: Date;
}

export interface FormattedReaction {
  userId: string;
  username?: string;
  type: ReactionType;
  created_at: string;
}
