import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFiles,
  MaxFileSizeValidator,
  HttpStatus,
  BadRequestException,
  Query,
  HttpCode,
  ParseFilePipe,
  Request,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { UploadMetadataDto } from './dto/upload-response.dto';
import { ResponseMessage } from '../../decorators/response-message.decorator';
import { Roles } from '../../decorators/roles.decorator';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Tải lên ảnh thành công')
  @UseInterceptors(FilesInterceptor('files', 50))
  async uploadFiles(
    @UploadedFiles(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 15 * 1024 * 1024 })],
      }),
    )
    files: Express.Multer.File[],
    @Query('prefix') prefix?: string,
    @Query('userId') userId?: string,
    @Query('roomId') roomId?: string,
  ) {
    // Create metadata object if any query params are provided
    let metadata: UploadMetadataDto | undefined;
    if (prefix || userId || roomId) {
      metadata = { prefix, userId, roomId };
    }

    return this.uploadService.uploadFiles(files, metadata);
  }

  @Post('room')
  @Roles('host')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Tải lên ảnh phòng thành công')
  @UseInterceptors(FilesInterceptor('files', 50))
  async uploadRoomImages(
    @UploadedFiles(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 15 * 1024 * 1024 })],
      }),
    )
    files: Express.Multer.File[],
    @Query('roomId') roomId: string,
    @Request() req: RequestWithUser,
  ) {
    if (!roomId) {
      throw new BadRequestException('roomId is required');
    }

    // Lấy userId từ JWT token
    const userId = req.user._id;

    return this.uploadService.uploadRoomImages(files, roomId, userId);
  }

  @Post('user')
  @Roles('guest', 'host', 'admin')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Tải lên ảnh người dùng thành công')
  @UseInterceptors(FilesInterceptor('files', 1))
  async uploadUserImages(
    @UploadedFiles(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })],
      }),
    )
    files: Express.Multer.File[],
    @Request() req: RequestWithUser,
  ) {
    // Lấy userId từ JWT token
    const userId = req.user._id;

    return this.uploadService.uploadUserImages(files, userId);
  }
}
