import { Config } from './models/config-models';

export const CONFIG: Config = {
  supportedMediaFileTypes: [
    { extension: '.jpeg', supportsExif: true },
    { extension: '.jpg',  supportsExif: true },
    { extension: '.heic', supportsExif: true },
    { extension: '.gif',  supportsExif: false },
    { extension: '.mp4',  supportsExif: true },
    { extension: '.png',  supportsExif: true },
    { extension: '.avi',  supportsExif: true },
    { extension: '.mov',  supportsExif: true },
  ],
};
