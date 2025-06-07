import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
  UploadResponseDto,
  UploadMetadataDto,
} from './dto/upload-response.dto';
import * as AWS from 'aws-sdk';
import { extname } from 'path';
import { diskStorage } from 'multer';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly tempDir = path.join(process.cwd(), 'temp');
  private readonly s3: AWS.S3;
  private readonly bucketName: string;
  private readonly cdnUrl: string;

  constructor(private readonly configService: ConfigService) {
    // Đảm bảo thư mục temp tồn tại
    fs.ensureDirSync(this.tempDir);

    // Lấy các giá trị cấu hình từ environment
    const region = this.configService.get<string>('DO_SPACES_REGION', 'sgp1');
    const accessKey = this.configService.get<string>('DO_SPACES_KEY');
    const secretKey = this.configService.get<string>('DO_SPACES_SECRET');
    this.bucketName = this.configService.get<string>(
      'DO_SPACES_BUCKET',
      'vinaside',
    );

    // Log cấu hình (masked) để debug
    this.logger.log(
      `Configuring S3 client with region: ${region}, bucket: ${this.bucketName}`,
    );
    this.logger.log(`Access key provided: ${accessKey ? 'Yes' : 'No'}`);
    this.logger.log(`Secret key provided: ${secretKey ? 'Yes' : 'No'}`);

    // Khởi tạo S3 client cho Digital Ocean Spaces
    const spacesEndpoint = new AWS.Endpoint(`${region}.digitaloceanspaces.com`);

    this.s3 = new AWS.S3({
      endpoint: spacesEndpoint,
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
    });

    this.cdnUrl = this.configService.get<string>(
      'DO_SPACES_CDN_URL',
      `https://${this.bucketName}.${region}.cdn.digitaloceanspaces.com`,
    );

    this.logger.log(
      `S3 client configured with endpoint: ${region}.digitaloceanspaces.com`,
    );
    this.logger.log(`CDN URL: ${this.cdnUrl}`);
  }

  /**
   * Cấu hình Multer cho upload ảnh
   */
  getMulterConfig(maxFiles: number = 50, maxSize: number = 15): MulterOptions {
    return {
      storage: diskStorage({
        destination: (req, file, cb) => {
          cb(null, 'temp');
        },
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return cb(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: maxSize * 1024 * 1024,
        files: maxFiles,
      },
    };
  }

  /**
   * Upload nhiều file cùng lúc
   * @param files Danh sách file cần upload
   * @param metadata Metadata tùy chọn (prefix, userId, roomId)
   */
  async uploadFiles(
    files: Express.Multer.File[],
    metadata?: UploadMetadataDto,
  ): Promise<UploadResponseDto> {
    if (!files || files.length === 0) {
      throw new BadRequestException('Không có file nào được tải lên');
    }

    try {
      this.logger.log(`Uploading ${files.length} files...`);

      // Upload file song song để tăng hiệu suất
      const uploadPromises = files.map((file) =>
        this.uploadToS3(file, metadata),
      );
      const results = await Promise.all(uploadPromises);

      this.logger.log(`Successfully uploaded ${results.length} files`);

      return {
        urls: results.map((result) => result.url),
        originalNames: files.map((file) => file.originalname),
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Lỗi khi tải lên các file: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error('Lỗi không xác định khi tải lên các file');
      }
      throw new InternalServerErrorException('Không thể tải lên các file');
    } finally {
      // Dọn dẹp file tạm
      await this.cleanupTempFiles(files);
    }
  }

  /**
   * Upload file cho phòng
   */
  async uploadRoomImages(
    files: Express.Multer.File[],
    roomId: string,
    userId?: string,
  ): Promise<UploadResponseDto> {
    if (!roomId) {
      throw new BadRequestException('Room ID là bắt buộc');
    }

    return this.uploadFiles(files, {
      prefix: 'room_',
      roomId,
      userId,
    });
  }

  /**
   * Upload file cho người dùng
   */
  async uploadUserImages(
    files: Express.Multer.File[],
    userId: string,
  ): Promise<UploadResponseDto> {
    if (!userId) {
      throw new BadRequestException('User ID là bắt buộc');
    }

    return this.uploadFiles(files, {
      prefix: 'user_',
      userId,
    });
  }

  /**
   * Dọn dẹp file tạm sau khi upload
   */
  private async cleanupTempFiles(files: Express.Multer.File[]): Promise<void> {
    if (!files || !Array.isArray(files)) return;

    for (const file of files) {
      try {
        if (!file || !file.path) continue;
        if (fs.existsSync(file.path)) {
          await fs.remove(file.path);
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          this.logger.warn(
            `Không thể xóa file tạm ${file?.path || 'unknown'}: ${error.message}`,
          );
        }
      }
    }
  }

  /**
   * Upload một file lên S3
   */
  private async uploadToS3(
    file: Express.Multer.File,
    metadata?: UploadMetadataDto,
  ): Promise<{ url: string }> {
    if (!file || !file.path) {
      throw new BadRequestException(
        `File không hợp lệ hoặc thiếu path: ${file?.originalname || 'unknown'}`,
      );
    }

    if (!fs.existsSync(file.path)) {
      throw new BadRequestException(`File path không tồn tại: ${file.path}`);
    }

    try {
      this.logger.log(
        `Uploading file ${file.originalname} (${file.size} bytes)`,
      );

      // Tạo key cho file
      const prefix = metadata?.prefix || '';
      const folder = metadata?.roomId
        ? `rooms/${metadata.roomId}/`
        : metadata?.userId
          ? `users/${metadata.userId}/`
          : 'general/';

      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = extname(file.originalname);
      const key = `uploads/${folder}${prefix}${uniqueSuffix}${ext}`;

      // Đọc file để upload
      const fileContent = await fs.readFile(file.path);

      // Upload file lên S3
      const params = {
        Bucket: this.bucketName,
        Key: key,
        Body: fileContent,
        ContentType: file.mimetype,
        ACL: 'public-read',
      };

      this.logger.log(
        `Uploading to S3 bucket: ${this.bucketName}, key: ${key}`,
      );
      await this.s3.upload(params).promise();

      const fileUrl = `${this.cdnUrl}/${key}`;
      this.logger.log(`File uploaded successfully, URL: ${fileUrl}`);

      // Trả về URL
      return { url: fileUrl };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Lỗi khi tải lên file ${file.originalname}: ${error.message}`,
          error.stack,
        );

        // Kiểm tra lỗi AWS cụ thể
        const awsError = error as AWS.AWSError;
        if (awsError.code) {
          this.logger.error(
            `AWS Error code: ${awsError.code}, message: ${awsError.message}`,
          );

          if (
            awsError.code === 'AccessDenied' ||
            awsError.code === 'CredentialsError'
          ) {
            throw new ServiceUnavailableException(
              'Không thể kết nối đến Digital Ocean Spaces - Lỗi xác thực',
            );
          }

          if (awsError.code === 'NoSuchBucket') {
            throw new ServiceUnavailableException(
              `Bucket "${this.bucketName}" không tồn tại`,
            );
          }
        }
      }

      throw new InternalServerErrorException(
        `Không thể tải lên file ${file.originalname}`,
      );
    }
  }
}
