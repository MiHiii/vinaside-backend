export interface ChatbotMessageData {
  message: string;
  userId: string;
  sessionId?: string;
}

export interface ChatbotResponse {
  success: boolean;
  data: any;
  statusCode: number;
  message: string;
}

export interface ExtractedSlots {
  city?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  nights?: number;
}

export interface BookingInfo {
  checkInDate: string | null;
  location: string | null;
  nights: number | null;
  guests: number | null;
}

export interface RoomSearchCriteria {
  city: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  nights: number;
}

export interface IntentMatch {
  intent: string;
  confidence: number;
  slots?: ExtractedSlots;
}

export interface ChatbotSession {
  userId: string;
  slots: ExtractedSlots;
  lastIntent?: string;
  conversationStep: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatbotConfig {
  enableFunctionCalling: boolean;
  maxRetries: number;
  timeout: number;
}

export interface MessagePattern {
  pattern: RegExp;
  intent: string;
  priority: number;
}

export interface RoomDetailPattern {
  pattern: RegExp;
  description: string;
}
