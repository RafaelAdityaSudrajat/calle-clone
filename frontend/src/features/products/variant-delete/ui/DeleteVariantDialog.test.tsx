import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteVariant,
  productKeys,
  willDeactivateOnVariantDelete,
  type ProductDetail,
  type Variant,
} from "@/entities/product";
import { getErrorMessage } from "@/shared/api";
import { DeleteVariantDialog } from "./delete-variant-dialog";

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
    deleteVariant: vi.fn(),
    willDeactivateOnVariantDelete: vi.fn(),
  };
});

vi.mock("@/shared/api", () => ({
  getErrorMessage: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : "Terjadi kesalahan",
  ),
}));

const PRODUCT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VARIANT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const makeVariant = (overrides: Partial<Variant> = {}): Variant => ({
  id: VARIANT_ID,
  sku: "KEMEJA-M-HTM",
  size: "M",
  color: "Hitam",
  price: 175000,
  stock: 15,
  low_stock: false,
  deleted_at: null,
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
  variants: [makeVariant()],
  images: [],
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

const renderDeleteVariantDialog = (
  props: Partial<React.ComponentProps<typeof DeleteVariantDialog>> = {},
  queryClient = createTestQueryClient(),
) => {
  const product = props.product ?? makeProduct();
  const variant = props.variant === undefined ? makeVariant() : props.variant;
  const onClose = props.onClose ?? vi.fn();

  return {
    product,
    variant,
    onClose,
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <DeleteVariantDialog
          product={product}
          variant={variant}
          onClose={onClose}
        />
      </QueryClientProvider>,
    ),
  };
};

describe("DeleteVariantDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(willDeactivateOnVariantDelete).mockReturnValue(false);
  });

  describe("Rendering & Deskripsi Peringatan (BR-27)", () => {
    it("tidak merender dialog saat variant bernilai null", () => {
      renderDeleteVariantDialog({ variant: null });

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("menampilkan deskripsi standar jika masih ada varian aktif tersisa", () => {
      vi.mocked(willDeactivateOnVariantDelete).mockReturnValue(false);
      const product = makeProduct();
      const variant = makeVariant({ sku: "KEMEJA-L-PTH" });

      renderDeleteVariantDialog({ product, variant });

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Hapus varian?")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Varian KEMEJA-L-PTH akan dihapus. SKU-nya tetap tidak bisa dipakai ulang.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/produk akan otomatis dinonaktifkan/i),
      ).not.toBeInTheDocument();
      expect(willDeactivateOnVariantDelete).toHaveBeenCalledWith(
        product,
        variant.id,
      );
    });

    it("menambahkan peringatan penonaktifan produk jika varian tersebut adalah varian aktif terakhir", () => {
      vi.mocked(willDeactivateOnVariantDelete).mockReturnValue(true);

      renderDeleteVariantDialog({
        variant: makeVariant({ sku: "KEMEJA-S-BRU" }),
      });

      expect(
        screen.getByText(
          "Varian KEMEJA-S-BRU akan dihapus. SKU-nya tetap tidak bisa dipakai ulang. Ini varian aktif terakhir, jadi produk akan otomatis dinonaktifkan.",
        ),
      ).toBeInTheDocument();
    });

    it("memanggil onClose saat tombol Batal diklik", async () => {
      const user = userEvent.setup();
      const { onClose } = renderDeleteVariantDialog();

      await user.click(screen.getByRole("button", { name: /batal/i }));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(deleteVariant).not.toHaveBeenCalled();
    });
  });

  describe("Alur Hapus Sukses", () => {
    it("menghapus varian, invalidate seluruh cache produk, menampilkan toast, dan memanggil onClose", async () => {
      const user = userEvent.setup();
      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      vi.mocked(deleteVariant).mockResolvedValue(undefined);

      const { onClose } = renderDeleteVariantDialog({}, queryClient);

      await user.click(screen.getByRole("button", { name: /^hapus$/i }));

      await waitFor(() => {
        expect(deleteVariant).toHaveBeenCalledWith(PRODUCT_ID, VARIANT_ID);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: productKeys.all,
      });
      expect(toast.success).toHaveBeenCalledWith("Varian dihapus");
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("menonaktifkan tombol Batal dan Hapus selama proses penghapusan berlangsung", async () => {
      const user = userEvent.setup();
      let resolveDelete!: () => void;

      vi.mocked(deleteVariant).mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveDelete = resolve;
          }),
      );

      renderDeleteVariantDialog();

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
      vi.mocked(getErrorMessage).mockReturnValue(
        "Varian sedang dipesan pelanggan",
      );
      vi.mocked(deleteVariant).mockRejectedValue(
        new Error("Varian sedang dipesan pelanggan"),
      );

      const { onClose } = renderDeleteVariantDialog();

      await user.click(screen.getByRole("button", { name: /^hapus$/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Varian sedang dipesan pelanggan",
        );
      });

      expect(onClose).not.toHaveBeenCalled();
    });
  });
});