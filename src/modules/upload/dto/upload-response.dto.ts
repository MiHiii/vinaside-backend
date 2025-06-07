export class UploadResponseDto {
  urls: string[];
  originalNames: string[];
}

export class UploadMetadataDto {
  prefix?: string;
  userId?: string;
  roomId?: string;
}

export class FileServerResponseDto {
  filenames: string[];
}
