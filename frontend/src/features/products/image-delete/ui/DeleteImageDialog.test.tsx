import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteProductImage,
  productKeys,
  willDeactivateOnImageDelete,
  type ProductDetail,
  type ProductImage,
} from "@/entities/product";
import { getErrorMessage } from "@/shared/api";
import { DeleteImageDialog } from "./delete-image-dialog";

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
    deleteProductImage: vi.fn(),
    willDeactivateOnImageDelete: vi.fn(),
  };
});

vi.mock("@/shared/api", () => ({
  getErrorMessage: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : "Terjadi kesalahan",
  ),
}));

const PRODUCT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const IMAGE_ID_1 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const IMAGE_ID_2 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const makeImage = (overrides: Partial<ProductImage> = {}): ProductImage => ({
  id: IMAGE_ID_1,
  url: "https://cdn.example.com/image-1.jpg",
  is_primary: false,
  sort_order: 1,
  ...overrides,
});

const makeProduct = (overrides: Partial<ProductDetail> = {}): ProductDetail => ({
  id: PRODUCT_ID,
  name: "Kemeja Linen",
  description: "Bahan adem untuk harian",
  category: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Pakaian",
  },
  status: "ACTIVE",
  variants: [],
  images: [
    makeImage({ id: IMAGE_ID_1, is_primary: true, sort_order: 0 }),
    makeImage({ id: IMAGE_ID_2, is_primary: false, sort_order: 1 }),
  ],
  created_by: "user-1",
  updated_by: "user-1",
  created_at: "2026-11-28T04:00:00.000Z",
  updated_at: "2026-11-28T04:00:00.000Z",
  ...overrides,
});

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderDeleteImageDialog = (
  props: Partial<React.ComponentProps<typeof DeleteImageDialog>> = {},
  queryClient = createTestQueryClient(),
) => {
  const product = props.product ?? makeProduct();
  const image = props.image === undefined ? makeImage() : props.image;
  const onClose = props.onClose ?? vi.fn();

  return {
    product,
    image,
    onClose,
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <DeleteImageDialog
          product={product}
          image={image}
          onClose={onClose}
        />
      </QueryClientProvider>,
    ),
  };
};

describe("DeleteImageDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(willDeactivateOnImageDelete).mockReturnValue(false);
  });

  describe("Rendering & Deskripsi Kontekstual (BR-20 & BR-27)", () => {
    it("tidak merender dialog saat image bernilai null", () => {
      renderDeleteImageDialog({ image: null });

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("menampilkan deskripsi dasar jika gambar bukan utama dan produk tetap aktif", () => {
      const product = makeProduct();
      const nonPrimaryImage = makeImage({ id: IMAGE_ID_2, is_primary: false });

      renderDeleteImageDialog({ product, image: nonPrimaryImage });

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Hapus gambar?")).toBeInTheDocument();
      expect(
        screen.getByText("Gambar akan dihapus permanen."),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/otomatis menjadi gambar utama/i),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/produk akan otomatis dinonaktifkan/i),
      ).not.toBeInTheDocument();
      expect(willDeactivateOnImageDelete).toHaveBeenCalledWith(
        product,
        nonPrimaryImage.id,
      );
    });

    it("menambahkan info perpindahan gambar utama jika gambar utama dihapus dan masih ada gambar lain", () => {
      const primaryImage = makeImage({ id: IMAGE_ID_1, is_primary: true });
      const product = makeProduct({
        images: [
          primaryImage,
          makeImage({ id: IMAGE_ID_2, is_primary: false }),
        ],
      });

      renderDeleteImageDialog({ product, image: primaryImage });

      expect(
        screen.getByText(
          "Gambar akan dihapus permanen. Gambar lain akan otomatis menjadi gambar utama.",
        ),
      ).toBeInTheDocument();
    });

    it("tidak menampilkan info perpindahan gambar utama jika hanya ada satu gambar pada produk", () => {
      const singleImage = makeImage({ id: IMAGE_ID_1, is_primary: true });
      const product = makeProduct({
        status: "DRAFT",
        images: [singleImage],
      });
      vi.mocked(willDeactivateOnImageDelete).mockReturnValue(false);

      renderDeleteImageDialog({ product, image: singleImage });

      expect(
        screen.getByText("Gambar akan dihapus permanen."),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/otomatis menjadi gambar utama/i),
      ).not.toBeInTheDocument();
    });

    it("menambahkan peringatan penonaktifan produk jika gambar tersebut adalah gambar terakhir pada produk aktif", () => {
      const lastImage = makeImage({ id: IMAGE_ID_1, is_primary: true });
      const product = makeProduct({
        status: "ACTIVE",
        images: [lastImage],
      });
      vi.mocked(willDeactivateOnImageDelete).mockReturnValue(true);

      renderDeleteImageDialog({ product, image: lastImage });

      expect(
        screen.getByText(
          "Gambar akan dihapus permanen. Ini gambar terakhir, jadi produk akan otomatis dinonaktifkan.",
        ),
      ).toBeInTheDocument();
    });

    it("memanggil onClose saat tombol Batal diklik tanpa menghapus gambar", async () => {
      const user = userEvent.setup();
      const { onClose } = renderDeleteImageDialog();

      await user.click(screen.getByRole("button", { name: /batal/i }));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(deleteProductImage).not.toHaveBeenCalled();
    });
  });

  describe("Alur Hapus Sukses", () => {
    it("menghapus gambar, invalidate seluruh cache produk, menampilkan toast, dan memanggil onClose", async () => {
      const user = userEvent.setup();
      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      vi.mocked(deleteProductImage).mockResolvedValue(undefined);

      const { onClose } = renderDeleteImageDialog(
        { image: makeImage({ id: IMAGE_ID_2 }) },
        queryClient,
      );

      await user.click(screen.getByRole("button", { name: /^hapus$/i }));

      await waitFor(() => {
        expect(deleteProductImage).toHaveBeenCalledWith(PRODUCT_ID, IMAGE_ID_2);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: productKeys.all,
      });
      expect(toast.success).toHaveBeenCalledWith("Gambar dihapus");
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("menonaktifkan tombol Batal dan Hapus selama proses penghapusan berlangsung", async () => {
      const user = userEvent.setup();
      let resolveDelete!: () => void;

      vi.mocked(deleteProductImage).mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveDelete = resolve;
          }),
      );

      renderDeleteImageDialog();

      const confirmBtn = screen.getByRole("button", { name: /^hapus$/i });
      const cancelBtn = screen.getByRole("button", { name: /batal/i });

      await user.click(confirmBtn);

      await waitFor(() => {
        expect(confirmBtn).toBeDisabled();
        expect(confirmBtn).toHaveAttribute("aria-busy", "true");
        expect(cancelBtn).toBeDisabled();
      });

      resolveDelete();

      await waitFor(() => {
        expect(confirmBtn).toHaveAttribute("aria-busy", "false");
        expect(cancelBtn).toBeEnabled();
      });
    });
  });

  describe("Penanganan Error", () => {
    it("menampilkan toast.error dan tidak menutup dialog jika penghapusan gagal", async () => {
      const user = userEvent.setup();
      vi.mocked(getErrorMessage).mockReturnValue("Gagal menghapus gambar");
      vi.mocked(deleteProductImage).mockRejectedValue(
        new Error("Gagal menghapus gambar"),
      );

      const { onClose } = renderDeleteImageDialog();

      await user.click(screen.getByRole("button", { name: /^hapus$/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Gagal menghapus gambar");
      });

      expect(onClose).not.toHaveBeenCalled();
    });
  });
});