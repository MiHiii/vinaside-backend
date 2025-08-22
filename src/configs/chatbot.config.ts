import { registerAs } from '@nestjs/config';

export interface ChatbotConfig {
  gemini: {
    apiKey: string;
    apiUrl: string;
    timeout: number;
    maxPromptLength: number;
    model: string;
  };
  internal: {
    dataUrl: string;
    timeout: number;
  };
  contact: {
    phone: string;
    website: string;
    checkInTime: string;
    checkOutTime: string;
  };
  ai: {
    enableFunctionCalling: boolean;
    enableStructuredOutput: boolean;
    systemInstruction: string;
  };
}

export default registerAs(
  'chatbot',
  (): ChatbotConfig => ({
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      apiUrl:
        process.env.GEMINI_API_URL ||
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
      timeout: parseInt(process.env.GEMINI_TIMEOUT || '15000'),
      maxPromptLength: parseInt(
        process.env.GEMINI_MAX_PROMPT_LENGTH || '15000',
      ),
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    },
    internal: {
      dataUrl:
        process.env.INTERNAL_DATA_URL ||
        'http://localhost:8080/api/v1/internal-data',
      timeout: parseInt(process.env.INTERNAL_DATA_TIMEOUT || '10000'),
    },
    contact: {
      phone: process.env.CONTACT_PHONE || '0909.123.456',
      website: process.env.CONTACT_WEBSITE || 'www.vinaside.com',
      checkInTime: process.env.CHECKIN_TIME || '14:00',
      checkOutTime: process.env.CHECKOUT_TIME || '12:00',
    },
    ai: {
      enableFunctionCalling: process.env.ENABLE_FUNCTION_CALLING === 'true',
      enableStructuredOutput: process.env.ENABLE_STRUCTURED_OUTPUT === 'true',
      systemInstruction: process.env.AI_SYSTEM_INSTRUCTION || 'default',
    },
  }),
);
