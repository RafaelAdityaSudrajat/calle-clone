import { useId, useState, type DragEvent } from "react";
import {
  IMAGE_ACCEPTED_TYPES,
  IMAGE_MAX_SIZE_BYTES,
} from "@/entities/product";
import { cn } from "@/shared/lib/cn";
import { useUploadImages } from "../model/use-upload-images";

const ACCEPT = IMAGE_ACCEPTED_TYPES.join(",");
const MAX_MB = IMAGE_MAX_SIZE_BYTES / 1024 / 1024;

export const ImageUploader = ({ productId }: { productId: string }) => {
  const { mutate, reset, isPending, progress, data } = useUploadImages(productId);
  const [isDragging, setIsDragging] = useState(false);
  const inputId = useId();

  const upload = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length > 0) mutate(files);
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (!isPending) upload(e.dataTransfer.files);
  };

  // Progres keseluruhan = file yang sudah selesai + progres file yang sedang berjalan.
  const overall =
    progress.total > 0
      ? Math.round(((progress.index - 1) * 100 + progress.percent) / progress.total)
      : 0;

  const failures = data?.failures ?? [];

  return (
    <div className="space-y-3">
      <label
        htmlFor={inputId}
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-8 text-center",
          "focus-within:ring-2 focus-within:ring-indigo-500/40",
          isDragging ? "border-indigo-500 bg-indigo-50" : "border-gray-300 hover:bg-gray-50",
          isPending && "cursor-not-allowed opacity-60",
        )}
      >
        <span className="text-sm font-medium text-gray-700">
          Seret gambar ke sini, atau klik untuk memilih
        </span>
        <span className="text-xs text-gray-500">
          JPG, PNG, atau WebP. Maksimal {MAX_MB} MB per file.
        </span>
        <input
          id={inputId}
          type="file"
          multiple
          accept={ACCEPT}
          disabled={isPending}
          className="sr-only"
          onChange={(e) => {
            upload(e.target.files);
            e.target.value = ""; // izinkan memilih file yang sama lagi
          }}
        />
      </label>

      {isPending && (
        <div className="space-y-1" role="status" aria-live="polite">
          <p className="text-sm text-gray-600">
            Mengunggah {progress.index} dari {progress.total}…
          </p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={overall}
            className="h-2 overflow-hidden bg-gray-200 rounded-full"
          >
            <div className="h-full transition-all bg-indigo-600" style={{ width: `${overall}%` }} />
          </div>
        </div>
      )}

      {!isPending && failures.length > 0 && (
        <div role="alert" className="p-3 text-sm text-red-800 border border-red-200 rounded-lg bg-red-50">
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium">Beberapa gambar gagal diunggah:</p>
            <button type="button" onClick={() => reset()} className="text-xs underline">
              Tutup
            </button>
          </div>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {failures.map((failure, i) => (
              <li key={`${failure.fileName}-${i}`}>
                <span className="font-medium">{failure.fileName}</span>: {failure.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};