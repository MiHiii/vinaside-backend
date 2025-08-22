import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

// Type definitions for structured bot messages
export enum BotMessageType {
  TEXT = 'text',
  LISTINGS = 'listings',
}

export enum CTAActionType {
  HOLD = 'HOLD',
  DETAIL = 'DETAIL',
}

export class MetaData {
  @IsOptional()
  @IsString()
  dateRange?: string;

  @IsOptional()
  @IsNumber()
  guests?: number;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsNumber()
  total?: number;
}

export class ListingItem {
  @IsString()
  id: string;

  @IsString()
  title: string;

  @IsNumber()
  pricePerNight: number;

  @IsOptional()
  @IsNumber()
  totalPrice?: number;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  detailUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class CTAButton {
  @IsString()
  label: string;

  @IsEnum(CTAActionType)
  action: CTAActionType;

  @IsOptional()
  payload?: any;
}

// DTO for text-only bot message
export class TextBotMessage {
  @IsString()
  readonly type: BotMessageType.TEXT = BotMessageType.TEXT;

  @IsString()
  text: string;
}

// DTO for listings bot message
export class ListingsBotMessage {
  @IsString()
  readonly type: BotMessageType.LISTINGS = BotMessageType.LISTINGS;

  @IsOptional()
  @IsString()
  header?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MetaData)
  meta?: MetaData;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ListingItem)
  items: ListingItem[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CTAButton)
  cta?: CTAButton;
}

// Union type for bot messages
export type BotMessage = TextBotMessage | ListingsBotMessage;

// DTO for receiving messages from the frontend
export class SocketChatbotMessageDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  user_id?: string;
}

// DTO for creating chatbot messages
export class CreateChatbotMessageDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  user_id?: string;
}

// Response DTO for sending messages to the frontend
export class ChatbotResponseDto {
  @ValidateNested()
  @Type(() => Object) // Will be either TextBotMessage or ListingsBotMessage
  message: BotMessage;
}
