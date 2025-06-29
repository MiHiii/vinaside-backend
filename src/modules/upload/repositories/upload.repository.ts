import { Injectable, Logger } from '@nestjs/common';
import {
  IUploadRepository,
  FileMetadata,
} from '../interfaces/upload-repository.interface';

@Injectable()
export class UploadRepository implements IUploadRepository {
  private readonly logger = new Logger(UploadRepository.name);

  // In-memory storage for demo - replace with actual database implementation
  private fileMetadataStorage: Map<string, FileMetadata> = new Map();

  saveFileMetadata(metadata: Omit<FileMetadata, 'id'>): Promise<FileMetadata> {
    const id = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fileMetadata: FileMetadata = {
      ...metadata,
      id,
    };

    this.fileMetadataStorage.set(metadata.s3Key, fileMetadata);
    this.logger.log(`Saved file metadata for key: ${metadata.s3Key}`);

    return Promise.resolve(fileMetadata);
  }

  findFileByKey(s3Key: string): Promise<FileMetadata | null> {
    const metadata = this.fileMetadataStorage.get(s3Key);
    return Promise.resolve(metadata || null);
  }

  findFilesByUserId(userId: string): Promise<FileMetadata[]> {
    const allFiles = Array.from(this.fileMetadataStorage.values());
    const userFiles = allFiles.filter(
      (file) => file.userId === userId && !file.deletedAt,
    );
    return Promise.resolve(userFiles);
  }

  findAllFiles(): Promise<FileMetadata[]> {
    const allFiles = Array.from(this.fileMetadataStorage.values());
    const activeFiles = allFiles.filter((file) => !file.deletedAt);
    return Promise.resolve(activeFiles);
  }

  markAsDeleted(s3Key: string): Promise<void> {
    const metadata = this.fileMetadataStorage.get(s3Key);
    if (metadata) {
      metadata.deletedAt = new Date();
      this.fileMetadataStorage.set(s3Key, metadata);
      this.logger.log(`Marked file as deleted: ${s3Key}`);
    }
    return Promise.resolve();
  }

  deleteFileMetadata(s3Key: string): Promise<void> {
    this.fileMetadataStorage.delete(s3Key);
    this.logger.log(`Deleted file metadata: ${s3Key}`);
    return Promise.resolve();
  }
}
