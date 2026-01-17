import { exiftool } from 'exiftool-vendored';
import { doesFileSupportExif } from './does-file-support-exif';
import { promises as fspromises } from 'fs';
import { MediaFileInfo } from '../models/media-file-info';
import { resolve } from 'path';
import { extname } from 'path';

const { unlink, copyFile } = fspromises;

export async function updateExifMetadata(fileInfo: MediaFileInfo, timeTaken: string, errorDir: string): Promise<void> {
  if (!doesFileSupportExif(fileInfo.outputFilePath)) {
    return;
  }

  try {
    const extension = extname(fileInfo.outputFilePath).toLowerCase();
    
    // Parse the ISO UTC date and format it explicitly with +00:00 timezone offset for consistency
    // This ensures all tools interpret it as UTC consistently
    const dateObj = new Date(timeTaken);
    const isoString = dateObj.toISOString();
    // Format: YYYY-MM-DDTHH:MM:SS.sssZ (or YYYY-MM-DD HH:MM:SS+00:00 for exiftool)
    const utcFormattedDate = isoString.replace('T', ' ').replace('Z', '+00:00');
    
    // Different file types use different metadata tags
    // For video files (MP4, MOV, AVI), we use CreateDate and MediaCreateDate
    // For image files (JPEG, HEIC, PNG, GIF), we use DateTimeOriginal
    // All dates use explicit UTC timezone (+00:00)
    let metadataTags: any = { DateTimeOriginal: utcFormattedDate };
    
    if (['.mp4', '.mov', '.avi'].includes(extension)) {
      // For video files, also set CreateDate and MediaCreateDate
      metadataTags = {
        DateTimeOriginal: utcFormattedDate,
        CreateDate: utcFormattedDate,
        MediaCreateDate: utcFormattedDate,
      };
    }
    
    await exiftool.write(fileInfo.outputFilePath, metadataTags);
  
    await unlink(`${fileInfo.outputFilePath}_original`); // exiftool will rename the old file to {filename}_original, we can delete that

  } catch (error) {
    await copyFile(fileInfo.outputFilePath,  resolve(errorDir, fileInfo.mediaFileName));
    if (fileInfo.jsonFileExists && fileInfo.jsonFileName && fileInfo.jsonFilePath) {
      await copyFile(fileInfo.jsonFilePath, resolve(errorDir, fileInfo.jsonFileName));
    }
  }
}
