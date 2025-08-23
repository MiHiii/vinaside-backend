export type SenderRole = 'guest' | 'staff' | 'admin';

export interface ConversationListItem {
  _id: string; // conversation_id
  thread_type: 'property';
  property: {
    _id: string;
    name: string;
    thumbnail?: string | null;
    status?: string | null;
    isVerified?: boolean;
  } | null;
  guest: {
    _id: string;
    name: string;
    avatar_url?: string | null;
  } | null;
  staff_summary: {
    count: number;
    last_active?: {
      _id: string;
      name: string;
      avatar_url?: string | null;
    } | null;
  };
  lastMessage: {
    _id: string;
    content: string;
    sender_id: string;
    sender_role: SenderRole;
    sent_at: string | Date;
    is_read: 'sent' | 'delivered' | 'read';
  } | null;
  lastMessageAt: string | Date | null;
  messageCount: number;
  ui_for: 'guest' | 'staff';
  display: {
    title: string;
    subtitle: string;
    avatar_url?: string | null;
    badge?: { text: string; avatar_url?: string | null } | null;
    unreadCount: number;
  };
}

export interface MessageUIFlags {
  mine: boolean;
  show_sender_meta: boolean;
  sender_display_name?: string;
  sender_avatar_url?: string | null;
}

export interface MessageUI {
  ui_for: 'guest' | 'staff';
  ui: MessageUIFlags;
}
