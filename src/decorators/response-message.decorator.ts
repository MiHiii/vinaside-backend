import { SetMetadata } from '@nestjs/common';

export const RESPONSE_MESSAGE_KEY = 'response_message';

/**
 * Decorator để thiết lập message cho response
 * @param message Thông báo sẽ được gửi về client
 * @returns Decorator để sử dụng trong controller
 * @example
 * ```typescript
 * @Post()
 * @ResponseMessage('Tạo người dùng thành công')
 * create(@Body() createUserDto: CreateUserDto) {
 *   return this.usersService.create(createUserDto);
 * }
 * ```
 */
export const ResponseMessage = (message: string) =>
  SetMetadata(RESPONSE_MESSAGE_KEY, message);
