import { Injectable, Logger } from '@nestjs/common';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { extname, join } from 'path';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly uploadDir = join(process.cwd(), 'public', 'uploads');

  constructor() {
    this.ensureUploadDirExists();
  }

  private ensureUploadDirExists() {
    try {
      if (!existsSync(this.uploadDir)) {
        mkdirSync(this.uploadDir, { recursive: true });
        this.logger.log(`Created upload directory: ${this.uploadDir}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to create upload directory: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async saveFile(file: Express.Multer.File): Promise<string> {
    this.ensureUploadDirExists();

    const fileExtension = extname(file.originalname);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const fileName = `${uniqueSuffix}${fileExtension}`;
    const filePath = join(this.uploadDir, fileName);

    await writeFile(filePath, file.buffer);
    this.logger.log(`Saved file to ${filePath}`);

    // Return the relative URL path that is accessible through our static assets middleware
    return `/public/uploads/${fileName}`;
  }
}
