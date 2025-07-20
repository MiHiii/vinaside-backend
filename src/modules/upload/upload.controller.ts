import {
  Controller,
  Post,
  Delete,
  Get,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  HttpStatus,
  HttpCode,
  Request,
  UseGuards,
  Param,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { ResponseMessage } from '../../decorators/response-message.decorator';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { Roles } from '../../decorators/roles.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { UserFileResponseDto } from './dto/upload-response.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiParam,
} from '@nestjs/swagger';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('File Upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @Roles('guest', 'staff', 'admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tải lên 1 ảnh avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: 'Ảnh avatar được tải lên thành công',
    schema: {
      example: {
        urls: ['https://cdn.vinaside.vn/avatar/abc123.jpg'],
        keys: ['avatar/abc123.jpg'],
        originalNames: ['avatar.jpg'],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Lỗi xác thực' })
  @ResponseMessage('Tải lên ảnh avatar thành công')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSingleImage(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: RequestWithUser,
  ) {
    const userId = req.user._id;
    return await this.uploadService.uploadSingleImageFromController(
      file,
      userId,
    );
  }

  @Post('multiple')
  @RequirePermission('upload.create')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tải lên nhiều ảnh listing (<50 ảnh)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: 'Các ảnh listing được tải lên thành công',
    schema: {
      example: {
        urls: [
          'https://cdn.vinaside.vn/listing/abc123.jpg',
          'https://cdn.vinaside.vn/listing/def456.jpg',
        ],
        keys: ['listing/abc123.jpg', 'listing/def456.jpg'],
        originalNames: ['image1.jpg', 'image2.jpg'],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Lỗi xác thực' })
  @ResponseMessage('Tải lên nhiều ảnh listing thành công')
  @UseInterceptors(FilesInterceptor('files', 50))
  async uploadMultipleImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req: RequestWithUser,
  ) {
    const userId = req.user._id;
    return await this.uploadService.uploadMultipleImagesFromController(
      files,
      userId,
    );
  }

  @Post('data')
  @UseGuards(PermissionGuard)
  @RequirePermission('upload.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tải lên file Excel/CSV (import)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: 'File dữ liệu được tải lên thành công',
    schema: {
      example: {
        urls: ['https://cdn.vinaside.vn/document/data_abc123.xlsx'],
        keys: ['document/data_abc123.xlsx'],
        originalNames: ['data.xlsx'],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Lỗi xác thực' })
  @ResponseMessage('Tải lên file dữ liệu thành công')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDataFile(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: RequestWithUser,
  ) {
    const userId = req.user._id;
    return await this.uploadService.uploadDataFileFromController(file, userId);
  }

  @Post('banner')
  @UseGuards(PermissionGuard)
  @RequirePermission('upload.create')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tải lên ảnh banner (Staff/Admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: 'Ảnh banner được tải lên thành công',
    schema: {
      example: {
        urls: ['https://cdn.vinaside.vn/banner/abc123.jpg'],
        keys: ['banner/abc123.jpg'],
        originalNames: ['banner.jpg'],
      },
    },
  })
  @ResponseMessage('Tải lên ảnh banner thành công')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBannerImage(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: RequestWithUser,
  ) {
    const userId = req.user._id;
    return await this.uploadService.uploadBannerImageFromController(
      file,
      userId,
    );
  }

  @Delete(':key')
  @UseGuards(PermissionGuard)
  @RequirePermission('upload.delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa file' })
  @ApiParam({
    name: 'key',
    description: 'Key của file trên S3 (cần encode URL)',
    example: 'avatar/abc123.jpg',
  })
  @ApiResponse({
    status: 200,
    description: 'File được xóa thành công',
  })
  @ApiResponse({ status: 400, description: 'Lỗi xác thực' })
  @ApiResponse({ status: 404, description: 'File không tồn tại' })
  @ResponseMessage('Xóa file thành công')
  async deleteFile(@Param('key') key: string, @Request() req: RequestWithUser) {
    const userId = req.user._id;
    const userRole = req.user.role;
    return await this.uploadService.deleteFileFromController(
      key,
      userId,
      userRole,
    );
  }

  @Get('files')
  @UseGuards(PermissionGuard)
  @RequirePermission('upload.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy danh sách tất cả file (Admin/Manager only)' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách tất cả file được truy xuất thành công',
    schema: {
      example: [
        {
          id: 'file_1234567890_abc123',
          fileName: 'avatar_1234567890.jpg',
          originalName: 'my-avatar.jpg',
          fileSize: 245760,
          mimeType: 'image/jpeg',
          url: 'https://cdn.vinaside.vn/avatar/abc123.jpg',
          fileType: 'image',
          uploadedAt: '2024-01-15T10:30:00.000Z',
        },
      ],
    },
  })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ResponseMessage('Lấy danh sách tất cả file thành công')
  async getAllFiles(): Promise<UserFileResponseDto[]> {
    return await this.uploadService.getAllFilesFromController();
  }
}
