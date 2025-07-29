export class PromptBuilder {
  static buildPrompt(userMessage: string, context?: string): string {
    let prompt =
      'Bạn là một trợ lý AI thông minh, hãy trả lời ngắn gọn, chính xác và thân thiện.';
    if (context) {
      prompt += `\nBối cảnh: ${context}`;
    }
    prompt += `\nNgười dùng: ${userMessage}\nAI:`;
    return prompt;
  }
}
