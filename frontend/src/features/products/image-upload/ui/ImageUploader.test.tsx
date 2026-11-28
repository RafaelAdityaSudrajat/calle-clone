import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  IMAGE_ACCEPTED_TYPES,
  productKeys,
  uploadProductImage,
  validateImageFile,
  type ProductImage,
} from "@/entities/product";
import { getErrorMessage, isApiError } from "@/shared/api";
import { ImageUploader } from "./image-uploader";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/entities/product", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/entities/product")>();
  return {
    ...actual,
    uploadProductImage: vi.fn(),
    validateImageFile: vi.fn(),
  };
});

vi.mock("@/shared/api", () => ({
  isApiError: vi.fn(),
  getErrorMessage: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : "Terjadi kesalahan",
  ),
}));

const PRODUCT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const makeFile = (name: string, type = "image/jpeg") =>
  new File(["dummy-image-content"], name, { type });

const makeUploadedImage = (
  id: string,
  sortOrder = 0,
): ProductImage => ({
  id,
  url: `https://cdn.example.com/${id}.jpg`,
  is_primary: sortOrder === 0,
  sort_order: sortOrder,
});

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderImageUploader = (
  productId = PRODUCT_ID,
  queryClient = createTestQueryClient(),
) => ({
  queryClient,
  ...render(
    <QueryClientProvider client={queryClient}>
      <ImageUploader productId={productId} />
    </QueryClientProvider>,
  ),
});

describe("ImageUploader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateImageFile).mockReturnValue(null);
    vi.mocked(isApiError).mockReturnValue(false);
  });

  describe("Rendering & Interaksi Drag-and-Drop", () => {
    it("merender area dropzone, panduan format file, dan input file multiple", () => {
      renderImageUploader();

      expect(
        screen.getByText("Seret gambar ke sini, atau klik untuk memilih"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/JPG, PNG, atau WebP\. Maksimal \d+ MB per file\./i),
      ).toBeInTheDocument();

      const fileInput = screen.getByLabelText(
        /seret gambar ke sini, atau klik untuk memilih/i,
      ) as HTMLInputElement;

      expect(fileInput).toHaveAttribute("type", "file");
      expect(fileInput).toHaveAttribute("multiple");
      expect(fileInput).toHaveAttribute("accept", IMAGE_ACCEPTED_TYPES.join(","));
      expect(fileInput).toBeEnabled();
    });

    it("mengubah tampilan dropzone saat dragEnter dan mengembalikannya saat dragLeave", () => {
      renderImageUploader();

      const dropzone = screen
        .getByText("Seret gambar ke sini, atau klik untuk memilih")
        .closest("label")!;

      expect(dropzone).toHaveClass("border-gray-300");

      fireEvent.dragEnter(dropzone);
      expect(dropzone).toHaveClass("border-indigo-500", "bg-indigo-50");

      fireEvent.dragLeave(dropzone);
      expect(dropzone).toHaveClass("border-gray-300");
    });

    it("mengunggah file saat dilepas (drop) ke area dropzone", async () => {
      vi.mocked(uploadProductImage).mockResolvedValue(
        makeUploadedImage("11111111-1111-4111-8111-111111111111"),
      );

      renderImageUploader();

      const dropzone = screen
        .getByText("Seret gambar ke sini, atau klik untuk memilih")
        .closest("label")!;
      const file = makeFile("foto-depan.jpg");

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [file] },
      });

      await waitFor(() => {
        expect(uploadProductImage).toHaveBeenCalledWith(
          PRODUCT_ID,
          file,
          expect.any(Function),
        );
      });
      expect(toast.success).toHaveBeenCalledWith("1 gambar berhasil diunggah");
    });
  });

  describe("Validasi Client-Side (validateImageFile)", () => {
    it("menampilkan daftar error dan tidak memanggil API jika file gagal validasi klien", async () => {
      // applyAccept: false agar file non-gambar tetap diteruskan ke handler onChange untuk diuji
      const user = userEvent.setup({ applyAccept: false });
      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      vi.mocked(validateImageFile).mockReturnValue(
        "Format file harus JPG, PNG, atau WebP",
      );

      renderImageUploader(PRODUCT_ID, queryClient);

      const fileInput = screen.getByLabelText(
        /seret gambar ke sini, atau klik untuk memilih/i,
      );
      await user.upload(fileInput, makeFile("katalog.pdf", "application/pdf"));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Beberapa gambar gagal diunggah:");
      expect(alert).toHaveTextContent(
        "katalog.pdf: Format file harus JPG, PNG, atau WebP",
      );

      expect(uploadProductImage).not.toHaveBeenCalled();
      expect(invalidateSpy).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("1 gambar gagal diunggah");
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("menutup panel daftar error saat tombol Tutup diklik", async () => {
      const user = userEvent.setup({ applyAccept: false });
      vi.mocked(validateImageFile).mockReturnValue("Ukuran file melebihi batas");

      renderImageUploader();

      const fileInput = screen.getByLabelText(
        /seret gambar ke sini, atau klik untuk memilih/i,
      );
      await user.upload(fileInput, makeFile("besar.jpg"));

      expect(await screen.findByRole("alert")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /tutup/i }));

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("Alur Unggah Sukses & Pelacakan Progres", () => {
    it("mengunggah beberapa gambar secara berurutan, invalidate cache, dan mereset input file", async () => {
      const user = userEvent.setup();
      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      vi.mocked(uploadProductImage)
        .mockResolvedValueOnce(
          makeUploadedImage("11111111-1111-4111-8111-111111111111", 0),
        )
        .mockResolvedValueOnce(
          makeUploadedImage("22222222-2222-4111-8111-222222222222", 1),
        );

      renderImageUploader(PRODUCT_ID, queryClient);

      const fileInput = screen.getByLabelText(
        /seret gambar ke sini, atau klik untuk memilih/i,
      ) as HTMLInputElement;

      const file1 = makeFile("foto-1.jpg");
      const file2 = makeFile("foto-2.png", "image/png");

      await user.upload(fileInput, [file1, file2]);

      await waitFor(() => {
        expect(uploadProductImage).toHaveBeenCalledTimes(2);
      });

      expect(uploadProductImage).toHaveBeenNthCalledWith(
        1,
        PRODUCT_ID,
        file1,
        expect.any(Function),
      );
      expect(uploadProductImage).toHaveBeenNthCalledWith(
        2,
        PRODUCT_ID,
        file2,
        expect.any(Function),
      );

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: productKeys.all,
      });
      expect(toast.success).toHaveBeenCalledWith("2 gambar berhasil diunggah");
      expect(toast.error).not.toHaveBeenCalled();

      // Input di-reset agar pengguna bisa memilih file yang sama kembali
      expect(fileInput.value).toBe("");
    });

    it("menampilkan indikator progres keseluruhan dan menonaktifkan input selama unggahan berlangsung", async () => {
      const user = userEvent.setup();
      let resolveFirst!: (img: ProductImage) => void;
      let resolveSecond!: (img: ProductImage) => void;
      let reportFirstProgress!: (percent: number) => void;
      let reportSecondProgress!: (percent: number) => void;

      vi.mocked(uploadProductImage)
        .mockImplementationOnce((_id, _file, onProgress) => {
          reportFirstProgress = onProgress!;
          return new Promise((resolve) => {
            resolveFirst = resolve;
          });
        })
        .mockImplementationOnce((_id, _file, onProgress) => {
          reportSecondProgress = onProgress!;
          return new Promise((resolve) => {
            resolveSecond = resolve;
          });
        });

      renderImageUploader();

      const fileInput = screen.getByLabelText(
        /seret gambar ke sini, atau klik untuk memilih/i,
      );

      await user.upload(fileInput, [
        makeFile("foto-1.jpg"),
        makeFile("foto-2.jpg"),
      ]);

      // File 1 dari 2 sedang berjalan (0% -> overall 0%)
      expect(await screen.findByText("Mengunggah 1 dari 2…")).toBeInTheDocument();
      expect(screen.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "0",
      );
      expect(fileInput).toBeDisabled();

      // File 1 mencapai 50% -> overall ((1 - 1) * 100 + 50) / 2 = 25%
      act(() => {
        reportFirstProgress(50);
      });
      expect(screen.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "25",
      );

      // Selesaikan file 1 -> lanjut file 2 dari 2 (0% -> overall 50%)
      await act(async () => {
        resolveFirst(makeUploadedImage("11111111-1111-4111-8111-111111111111"));
      });

      expect(await screen.findByText("Mengunggah 2 dari 2…")).toBeInTheDocument();
      expect(screen.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "50",
      );

      // File 2 mencapai 50% -> overall ((2 - 1) * 100 + 50) / 2 = 75%
      act(() => {
        reportSecondProgress(50);
      });
      expect(screen.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "75",
      );

      await act(async () => {
        resolveSecond(
          makeUploadedImage("22222222-2222-4111-8111-222222222222", 1),
        );
      });

      await waitFor(() => {
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
      });
      expect(fileInput).toBeEnabled();
    });
  });

  describe("Unggah Parsial & Error Fatal API", () => {
    it("menangani batch campuran (sebagian sukses, gagal validasi, dan gagal server)", async () => {
      const user = userEvent.setup({ applyAccept: false });
      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const validFile = makeFile("valid.jpg");
      const invalidFile = makeFile("rusak.gif", "image/gif");
      const serverFailFile = makeFile("timeout.jpg");

      vi.mocked(validateImageFile).mockImplementation((file) =>
        file.name === "rusak.gif" ? "Format tidak didukung" : null,
      );

      vi.mocked(getErrorMessage).mockReturnValue("Gagal menyimpan ke storage");
      vi.mocked(uploadProductImage)
        .mockResolvedValueOnce(
          makeUploadedImage("11111111-1111-4111-8111-111111111111"),
        )
        .mockRejectedValueOnce(new Error("Gagal menyimpan ke storage"));

      renderImageUploader(PRODUCT_ID, queryClient);

      const fileInput = screen.getByLabelText(
        /seret gambar ke sini, atau klik untuk memilih/i,
      );
      await user.upload(fileInput, [validFile, invalidFile, serverFailFile]);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("rusak.gif: Format tidak didukung");
      expect(alert).toHaveTextContent(
        "timeout.jpg: Gagal menyimpan ke storage",
      );

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: productKeys.all,
      });
      expect(toast.success).toHaveBeenCalledWith("1 gambar berhasil diunggah");
      expect(toast.error).toHaveBeenCalledWith("2 gambar gagal diunggah");
    });

    it("menghentikan sisa unggahan secara langsung jika menerima error fatal 404/401/403", async () => {
      const user = userEvent.setup();
      const notFoundError = { status: 404, message: "Produk tidak ditemukan" };

      vi.mocked(isApiError).mockReturnValue(true);
      vi.mocked(getErrorMessage).mockReturnValue("Produk tidak ditemukan");
      vi.mocked(uploadProductImage).mockRejectedValueOnce(notFoundError);

      renderImageUploader();

      const fileInput = screen.getByLabelText(
        /seret gambar ke sini, atau klik untuk memilih/i,
      );
      await user.upload(fileInput, [
        makeFile("foto-1.jpg"),
        makeFile("foto-2.jpg"),
        makeFile("foto-3.jpg"),
      ]);

      await waitFor(() => {
        expect(uploadProductImage).toHaveBeenCalledTimes(1);
      });

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("foto-1.jpg: Produk tidak ditemukan");
      expect(alert).not.toHaveTextContent("foto-2.jpg");
      expect(toast.error).toHaveBeenCalledWith("1 gambar gagal diunggah");
    });
  });
});