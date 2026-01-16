import { exiftool } from 'exiftool-vendored';
import { doesFileSupportExif } from './does-file-support-exif';
import { isNullOrUndefined } from './is-null-or-undefined';
import { MediaFileInfo } from '../models/media-file-info';
import { readPhotoTakenTimeFromGoogleJson } from './read-photo-taken-time-from-google-json';

export async function doesExifDateMatchPhotoTakenTime(mediaFile: MediaFileInfo): Promise<boolean> {
  if (!doesFileSupportExif(mediaFile.outputFilePath)) {
    return true; // If it doesn't support EXIF, we can't compare, so return true
  }

  const photoTakenTime = await readPhotoTakenTimeFromGoogleJson(mediaFile);
  if (isNullOrUndefined(photoTakenTime)) {
    return true; // If we don't have a photo taken time, we can't compare, so return true
  }

  try {
    const readResult = await exiftool.read(mediaFile.outputFilePath);
    const exifDate = readResult.DateTimeOriginal;

    if (isNullOrUndefined(exifDate)) {
      return false; // EXIF date doesn't exist, so it doesn't match
    }

    // Convert EXIF date to ISO string for comparison
    const exifDateObj = new Date(exifDate as any);
    const exifDateIso = exifDateObj.toISOString();
    
    return exifDateIso === photoTakenTime;
  } catch (error) {
    return true; // If we can't read the EXIF, assume it matches (don't update)
  }
}
