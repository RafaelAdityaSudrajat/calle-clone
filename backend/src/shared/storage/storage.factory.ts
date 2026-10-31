// storage.factory.ts
import { CloudinaryStorageProvider } from "./cloudinary-storage.provider";
import { LocalStorageProvider } from "./local-storage.provider";
import type { StorageProvider } from "./storage.types";

export function createStorageProvider(): StorageProvider {
  const driver = (process.env.STORAGE_DRIVER ?? "cloudinary").toLowerCase();

  if (driver === "local") {
    return new LocalStorageProvider({
      baseDir: process.env.LOCAL_UPLOAD_DIR ?? "uploads",
      publicPath: "/uploads",
    });
  }
  if (driver === "cloudinary") {
    return new CloudinaryStorageProvider({
      folder: process.env.CLOUDINARY_FOLDER ?? "bloods",
    });
  }
  throw new Error(`Unknown STORAGE_DRIVER: "${driver}"`);
}

export const storage: StorageProvider = createStorageProvider();
