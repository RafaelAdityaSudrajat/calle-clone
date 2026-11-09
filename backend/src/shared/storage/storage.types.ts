export interface UploadInput {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  scope?: string; // sub-folder, mis. `products/${productId}`
}

export interface UploadResult {
  key: string; // disimpan ke kolom `file_key` → untuk delete
  url: string; // disimpan ke kolom `url`     → untuk render
}

export interface StorageProvider {
  upload(input: UploadInput): Promise<UploadResult>;
  delete(key: string): Promise<void>; // WAJIB idempotent
}
