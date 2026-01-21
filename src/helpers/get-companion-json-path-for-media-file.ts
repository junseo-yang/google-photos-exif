import { existsSync } from "fs"
import { basename, dirname, extname, resolve } from 'path'
import { readdirSync } from 'fs'

export function getCompanionJsonPathForMediaFile(mediaFilePath: string): string|null {
  const directoryPath = dirname(mediaFilePath);
  const mediaFileExtension = extname(mediaFilePath);
  let mediaFileNameWithoutExtension = basename(mediaFilePath, mediaFileExtension);

  // Sometimes (if the photo has been edited inside Google Photos) we get files with a `-edited` suffix
  // These images don't have their own .json sidecars - for these we'd want to use the JSON sidecar for the original image
  // so we can ignore the "-edited" suffix if there is one
  mediaFileNameWithoutExtension = mediaFileNameWithoutExtension.replace(/[-]edited$/i, '');

  // The naming pattern for the JSON sidecar files provided by Google Takeout seem to be inconsistent. For `foo.jpg`,
  // the JSON file is sometimes `foo.json` but sometimes it's `foo.jpg.json`. Google also provides a `supplemental-metadata.json`
  // file with the naming pattern `foo.jpg.supplemental-metadata.json`. Here we start building up a list of potential
  // JSON filenames so that we can try to find them later
  const potentialJsonFileNames: string[] = [
    `${mediaFileNameWithoutExtension}.json`,
    `${mediaFileNameWithoutExtension}${mediaFileExtension}.json`,
    `${mediaFileNameWithoutExtension}${mediaFileExtension}.supplemental-metadata.json`,
  ];

  // Another edge case which seems to be quite inconsistent occurs when we have media files containing a number suffix for example "foo(1).jpg"
  // In this case, we don't get "foo(1).json" nor "foo(1).jpg.json". Instead, we strangely get "foo.jpg(1).json".
  // We can use a regex to look for this edge case and add that to the potential JSON filenames to look out for
  // We also need to check for the supplemental-metadata variant: "foo.jpg.supplemental-metadata(1).json"
  const nameWithCounterMatch = mediaFileNameWithoutExtension.match(/(?<name>.*)(?<counter>\(\d+\))$/);
  if (nameWithCounterMatch) {
    const name = nameWithCounterMatch?.groups?.['name'];
    const counter = nameWithCounterMatch?.groups?.['counter'];
    potentialJsonFileNames.push(`${name}${mediaFileExtension}${counter}.json`);
    potentialJsonFileNames.push(`${name}${mediaFileExtension}.supplemental-metadata${counter}.json`);
  }

  // Sometimes the media filename ends with extra dash (eg. filename_n-.jpg + filename_n.json)
  const endsWithExtraDash = mediaFileNameWithoutExtension.endsWith('_n-');

  // Sometimes the media filename ends with extra `n` char (eg. filename_n.jpg + filename_.json)
  const endsWithExtraNChar = mediaFileNameWithoutExtension.endsWith('_n');

  // And sometimes the media filename has extra underscore in it (e.g. filename_.jpg + filename.json)
  const endsWithExtraUnderscore = mediaFileNameWithoutExtension.endsWith('_');

  if (endsWithExtraDash || endsWithExtraNChar || endsWithExtraUnderscore) {
    // We need to remove that extra char at the end
    const baseNameWithoutExtraChar = mediaFileNameWithoutExtension.slice(0, -1);
    potentialJsonFileNames.push(`${baseNameWithoutExtraChar}.json`);
    potentialJsonFileNames.push(`${baseNameWithoutExtraChar}${mediaFileExtension}.json`);
    potentialJsonFileNames.push(`${baseNameWithoutExtraChar}${mediaFileExtension}.supplemental-metadata.json`);
  }

  // Now look to see if we have a JSON file in the same directory as the image for any of the potential JSON file names
  // that we identified earlier
  for (const potentialJsonFileName of potentialJsonFileNames) {
    const jsonFilePath = resolve(directoryPath, potentialJsonFileName);
    if (existsSync(jsonFilePath)) {
      return jsonFilePath;
    }
  }

  // Fallback: If no specific JSON file was found, look for a supplemental-metadata.json file with the same base name
  // but with a different media file extension. This handles the case where IMG_0201.HEIC and IMG_0201.MP4 both use
  // IMG_0201.HEIC.supplemental-metadata.json or IMG_0201.MP4.supplemental-metadata.json
  try {
    const filesInDirectory = readdirSync(directoryPath);
    for (const file of filesInDirectory) {
      // Look for files matching the pattern: {baseNameWithoutExtension}.{any-extension}.supplemental-metadata.json
      if (file.startsWith(mediaFileNameWithoutExtension) && file.endsWith('.supplemental-metadata.json')) {
        const candidatePath = resolve(directoryPath, file);
        if (existsSync(candidatePath)) {
          return candidatePath;
        }
      }
    }
  } catch (error) {
    // If we can't read the directory, just continue
  }

  // Final fallback: If no JSON file was found and the filename might have been truncated (e.g., filename_.mp4 from filename_high.mp4),
  // look for ANY JSON file that starts with the base name, but only if it doesn't have a counter suffix.
  // This handles cases where filenames are truncated due to length limits.
  // We exclude files with counter suffixes to avoid matching SNOW.mp4.supplemental-metadata(1).json for SNOW.mp4
  try {
    const filesInDirectory = readdirSync(directoryPath);
    for (const file of filesInDirectory) {
      // Look for any .json file that starts with our media filename (which might be truncated)
      // but exclude files with counter patterns like (1), (2), etc. unless our media file also has a counter
      if (file.startsWith(mediaFileNameWithoutExtension) && file.endsWith('.json')) {
        // Check if the JSON file has a counter suffix
        const hasCounterSuffix = /\(\d+\)\.json$/.test(file);
        // Only match if both have counters or neither have counters
        const mediaHasCounter = /\(\d+\)$/.test(mediaFileNameWithoutExtension);
        if (hasCounterSuffix === mediaHasCounter) {
          const candidatePath = resolve(directoryPath, file);
          if (existsSync(candidatePath)) {
            return candidatePath;
          }
        }
      }
    }
  } catch (error) {
    // If we can't read the directory, just continue
  }

  // Another fallback: Look for JSON files that could be the original filename before truncation.
  // This handles cases where the media file is truncated (e.g., _talkv_wmAq9538na_P1jlMs3zsts6kCdsXUWL10_talkv_high.mp4)
  // but the JSON file is the truncated version (e.g., _talkv_wmAq9538na_P1jlMs3zsts6kCdsXUWL10_talkv.json).
  // In this case, the media filename starts with the JSON filename without extension.
  try {
    const filesInDirectory = readdirSync(directoryPath);
    for (const file of filesInDirectory) {
      if (file.endsWith('.json')) {
        const jsonFileNameWithoutExtension = file.slice(0, -5); // Remove .json
        // Check if our media filename starts with this JSON base name
        if (mediaFileNameWithoutExtension.startsWith(jsonFileNameWithoutExtension)) {
          const candidatePath = resolve(directoryPath, file);
          if (existsSync(candidatePath)) {
            return candidatePath;
          }
        }
      }
    }
  } catch (error) {
    // If we can't read the directory, just continue
  }

  // Special case: For video files, check if there's a corresponding image file with JSON metadata
  // This handles cases where Google Photos exports both an image and video (e.g., IMG.jpg and IMG.mp4)
  // and the JSON metadata is only provided for the image file
  if (['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv', '.m4v'].includes(mediaFileExtension.toLowerCase())) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.heic', '.webp'];
    
    for (const imgExt of imageExtensions) {
      // Case 1: Look for image file with the same name (including counter if present)
      // E.g., for FullSizeRender(1).MP4, look for FullSizeRender(1).jpg
      const companionImageNameSameCounter = `${mediaFileNameWithoutExtension}${imgExt}`;
      const companionImagePathSameCounter = resolve(directoryPath, companionImageNameSameCounter);
      
      if (existsSync(companionImagePathSameCounter)) {
        // For files with counter suffix, Google provides: FullSizeRender.jpg.supplemental-metadata(1).json
        // Extract the counter from the original filename
        const counterMatch = mediaFileNameWithoutExtension.match(/\(\d+\)$/);
        if (counterMatch) {
          // Look for FullSizeRender.jpg.supplemental-metadata(1).json
          const baseNameWithoutCounter = mediaFileNameWithoutExtension.slice(0, counterMatch.index);
          const jsonWithCounter = `${baseNameWithoutCounter}${imgExt}.supplemental-metadata${counterMatch[0]}.json`;
          const jsonWithCounterPath = resolve(directoryPath, jsonWithCounter);
          if (existsSync(jsonWithCounterPath)) {
            return jsonWithCounterPath;
          }
        }
        
        // Also try standard companion JSON patterns
        const companionJsonCandidates = [
          `${mediaFileNameWithoutExtension}${imgExt}.json`,
          `${mediaFileNameWithoutExtension}${imgExt}.supplemental-metadata.json`,
        ];
        
        for (const candidate of companionJsonCandidates) {
          const candidatePath = resolve(directoryPath, candidate);
          if (existsSync(candidatePath)) {
            return candidatePath;
          }
        }
      }
      
      // Case 2: Look for base image file without counter
      // E.g., for FullSizeRender(1).MP4, also check if FullSizeRender.jpg exists
      const baseNameMatch = mediaFileNameWithoutExtension.match(/^(.+?)\(\d+\)$/);
      if (baseNameMatch) {
        const baseNameWithoutCounter = baseNameMatch[1];
        const companionImageNameBase = `${baseNameWithoutCounter}${imgExt}`;
        const companionImagePathBase = resolve(directoryPath, companionImageNameBase);
        
        if (existsSync(companionImagePathBase)) {
          // For base files, Google provides: FullSizeRender.jpg.supplemental-metadata.json
          const jsonBase = `${baseNameWithoutCounter}${imgExt}.supplemental-metadata.json`;
          const jsonBasePath = resolve(directoryPath, jsonBase);
          if (existsSync(jsonBasePath)) {
            return jsonBasePath;
          }
          
          // Also try standard patterns
          const baseJsonCandidates = [
            `${baseNameWithoutCounter}${imgExt}.json`,
          ];
          
          for (const candidate of baseJsonCandidates) {
            const candidatePath = resolve(directoryPath, candidate);
            if (existsSync(candidatePath)) {
              return candidatePath;
            }
          }
        }
      }
    }
  }

  // If no JSON file was found, just return null - we won't be able to adjust the date timestamps without finding a
  // suitable JSON sidecar file
  return null;
}
