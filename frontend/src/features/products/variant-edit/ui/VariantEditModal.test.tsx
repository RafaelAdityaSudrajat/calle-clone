import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  productKeys,
  updateVariant,
  type Variant,
  type VariantMutationResponse,
} from "@/entities/product";
import { getErrorMessage, isApiError } from "@/shared/api";
import { VariantEditModal } from "./variant-edit-modal";

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
    updateVariant: vi.fn(),
  };
});

vi.mock("@/shared/api", () => ({
  isApiError: vi.fn(),
  getErrorMessage: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : "Terjadi kesalahan",
  ),
}));

const PRODUCT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VARIANT_ID_1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const VARIANT_ID_2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const makeVariant = (overrides: Partial<Variant> = {}): Variant => ({
  id: VARIANT_ID_1,
  sku: "KEMEJA-M-HTM",
  size: "M",
  color: "Hitam",
  price: 175000,
  stock: 20,
  low_stock: false,
  deleted_at: null,
  ...overrides,
});

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderVariantEditModal = (
  props: Partial<React.ComponentProps<typeof VariantEditModal>> = {},
  queryClient = createTestQueryClient(),
) => {
  const variant = props.variant === undefined ? makeVariant() : props.variant;
  const onClose = props.onClose ?? vi.fn();

  return {
    variant,
    onClose,
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <VariantEditModal
          productId={props.productId ?? PRODUCT_ID}
          variant={variant}
          onClose={onClose}
        />
      </QueryClientProvider>,
    ),
  };
};

describe("VariantEditModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isApiError).mockReturnValue(false);
  });

  describe("Rendering, Inisialisasi Data & Kontrol Dialog", () => {
    it("tidak merender dialog saat variant bernilai null", () => {
      renderVariantEditModal({ variant: null });

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("merender dialog, mengisi nilai awal varian, dan menonaktifkan tombol submit saat belum ada perubahan", () => {
      renderVariantEditModal();

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Edit varian")).toBeInTheDocument();
      expect(screen.getByText("Ubah detail varian ini.")).toBeInTheDocument();

      expect(screen.getByLabelText(/^sku$/i)).toHaveValue("KEMEJA-M-HTM");
      expect(screen.getByLabelText(/ukuran/i)).toHaveValue("M");
      expect(screen.getByLabelText(/warna/i)).toHaveValue("Hitam");
      expect(screen.getByLabelText(/harga \(rp\)/i)).toHaveValue(175000);
      expect(screen.getByLabelText(/stok/i)).toHaveValue(20);

      expect(screen.getByRole("button", { name: /batal/i })).toBeEnabled();
      expect(
        screen.getByRole("button", { name: /simpan perubahan/i }),
      ).toBeDisabled();
    });

    it("mengisi string kosong jika size dan color pada varian bernilai null", () => {
      renderVariantEditModal({
        variant: makeVariant({ size: null, color: null }),
      });

      expect(screen.getByLabelText(/ukuran/i)).toHaveValue("");
      expect(screen.getByLabelText(/warna/i)).toHaveValue("");
    });

    it("mereset isi form saat prop variant berganti ke varian lain (key={variant.id})", () => {
      const queryClient = createTestQueryClient();
      const onClose = vi.fn();

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <VariantEditModal
            productId={PRODUCT_ID}
            variant={makeVariant()}
            onClose={onClose}
          />
        </QueryClientProvider>,
      );

      expect(screen.getByLabelText(/^sku$/i)).toHaveValue("KEMEJA-M-HTM");

      rerender(
        <QueryClientProvider client={queryClient}>
          <VariantEditModal
            productId={PRODUCT_ID}
            variant={makeVariant({
              id: VARIANT_ID_2,
              sku: "KEMEJA-L-PTH",
              size: "L",
              color: "Putih",
              price: 185000,
              stock: 5,
            })}
            onClose={onClose}
          />
        </QueryClientProvider>,
      );

      expect(screen.getByLabelText(/^sku$/i)).toHaveValue("KEMEJA-L-PTH");
      expect(screen.getByLabelText(/ukuran/i)).toHaveValue("L");
      expect(screen.getByLabelText(/warna/i)).toHaveValue("Putih");
      expect(screen.getByLabelText(/harga \(rp\)/i)).toHaveValue(185000);
      expect(screen.getByLabelText(/stok/i)).toHaveValue(5);
      expect(
        screen.getByRole("button", { name: /simpan perubahan/i }),
      ).toBeDisabled();
    });

    it("memanggil onClose saat tombol Batal diklik", async () => {
      const user = userEvent.setup();
      const { onClose } = renderVariantEditModal();

      await user.click(screen.getByRole("button", { name: /batal/i }));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(updateVariant).not.toHaveBeenCalled();
    });
  });

  describe("Status Dirty (isDirty)", () => {
    it("mengaktifkan tombol submit saat field diubah dan menonaktifkannya kembali jika dikembalikan ke nilai awal", async () => {
      const user = userEvent.setup();
      renderVariantEditModal();

      const skuInput = screen.getByLabelText(/^sku$/i);
      const submitBtn = screen.getByRole("button", {
        name: /simpan perubahan/i,
      });

      expect(submitBtn).toBeDisabled();

      await user.clear(skuInput);
      await user.type(skuInput, "KEMEJA-M-HTM-NEW");
      expect(submitBtn).toBeEnabled();

      await user.clear(skuInput);
      await user.type(skuInput, "KEMEJA-M-HTM");
      expect(submitBtn).toBeDisabled();
    });
  });

  describe("Validasi Client-Side (Zod)", () => {
    it("menampilkan error jika SKU dikosongkan", async () => {
      const user = userEvent.setup();
      renderVariantEditModal();

      const skuInput = screen.getByLabelText(/^sku$/i);
      await user.clear(skuInput);
      await user.click(
        screen.getByRole("button", { name: /simpan perubahan/i }),
      );

      expect(await screen.findByText("SKU wajib diisi")).toBeInTheDocument();
      expect(skuInput).toHaveAttribute("aria-invalid", "true");
      expect(updateVariant).not.toHaveBeenCalled();
    });

    it("menampilkan error pada field Ukuran jika ukuran dan warna sama-sama dikosongkan", async () => {
      const user = userEvent.setup();
      renderVariantEditModal();

      await user.clear(screen.getByLabelText(/ukuran/i));
      await user.clear(screen.getByLabelText(/warna/i));
      await user.click(
        screen.getByRole("button", { name: /simpan perubahan/i }),
      );

      const errorAlert = await screen.findByText(
        "Isi minimal salah satu: ukuran atau warna",
      );
      expect(errorAlert).toHaveAttribute("role", "alert");
      expect(screen.getByLabelText(/ukuran/i)).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect(updateVariant).not.toHaveBeenCalled();
    });

    it("menampilkan error jika harga bernilai 0 atau negatif", async () => {
      const user = userEvent.setup();
      renderVariantEditModal();

      const priceInput = screen.getByLabelText(/harga \(rp\)/i);
      fireEvent.change(priceInput, { target: { value: "0" } });
      await user.click(
        screen.getByRole("button", { name: /simpan perubahan/i }),
      );

      expect(
        await screen.findByText("Harga harus lebih dari 0"),
      ).toBeInTheDocument();
      expect(updateVariant).not.toHaveBeenCalled();
    });

    it("menampilkan error jika stok negatif atau bukan bilangan bulat", async () => {
      const user = userEvent.setup();
      renderVariantEditModal();

      const stockInput = screen.getByLabelText(/stok/i);
      fireEvent.change(stockInput, { target: { value: "-1" } });
      await user.click(
        screen.getByRole("button", { name: /simpan perubahan/i }),
      );

      expect(
        await screen.findByText("Stok tidak boleh negatif"),
      ).toBeInTheDocument();

      fireEvent.change(stockInput, { target: { value: "5.5" } });
      await user.click(
        screen.getByRole("button", { name: /simpan perubahan/i }),
      );

      expect(
        await screen.findByText("Stok harus bilangan bulat"),
      ).toBeInTheDocument();
      expect(updateVariant).not.toHaveBeenCalled();
    });
  });

  describe("Alur Submit Sukses", () => {
    it("mengirim payload terformat, invalidate cache produk, tampilkan toast, dan memanggil onClose", async () => {
      const user = userEvent.setup();
      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      vi.mocked(updateVariant).mockResolvedValue({
        id: VARIANT_ID_1,
        sku: "KEMEJA-XL-NVY",
        size: "XL",
        color: "Navy",
        price: 190000,
        stock: 30,
        low_stock: false,
      });

      const { onClose } = renderVariantEditModal({}, queryClient);

      const skuInput = screen.getByLabelText(/^sku$/i);
      const sizeInput = screen.getByLabelText(/ukuran/i);
      const colorInput = screen.getByLabelText(/warna/i);
      const priceInput = screen.getByLabelText(/harga \(rp\)/i);
      const stockInput = screen.getByLabelText(/stok/i);

      await user.clear(skuInput);
      await user.type(skuInput, "  KEMEJA-XL-NVY  ");
      await user.clear(sizeInput);
      await user.type(sizeInput, "  XL  ");
      await user.clear(colorInput);
      await user.type(colorInput, "  Navy  ");
      await user.clear(priceInput);
      await user.type(priceInput, "190000");
      await user.clear(stockInput);
      await user.type(stockInput, "30");

      await user.click(
        screen.getByRole("button", { name: /simpan perubahan/i }),
      );

      await waitFor(() => {
        expect(updateVariant).toHaveBeenCalledWith(PRODUCT_ID, VARIANT_ID_1, {
          sku: "KEMEJA-XL-NVY",
          size: "XL",
          color: "Navy",
          price: 190000,
          stock: 30,
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: productKeys.all,
      });
      expect(toast.success).toHaveBeenCalledWith("Varian berhasil diperbarui");
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("mengirim size atau color sebagai null jika salah satunya dikosongkan", async () => {
      const user = userEvent.setup();
      vi.mocked(updateVariant).mockResolvedValue({
        id: VARIANT_ID_1,
        sku: "KEMEJA-M-HTM",
        size: null,
        color: "Hitam",
        price: 175000,
        stock: 20,
        low_stock: false,
      });

      renderVariantEditModal();

      await user.clear(screen.getByLabelText(/ukuran/i));
      await user.click(
        screen.getByRole("button", { name: /simpan perubahan/i }),
      );

      await waitFor(() => {
        expect(updateVariant).toHaveBeenCalledWith(PRODUCT_ID, VARIANT_ID_1, {
          sku: "KEMEJA-M-HTM",
          size: null,
          color: "Hitam",
          price: 175000,
          stock: 20,
        });
      });
    });

    it("menonaktifkan tombol Simpan perubahan dan Batal selama proses submit berlangsung", async () => {
      const user = userEvent.setup();
      let resolveUpdate!: (value: VariantMutationResponse) => void;

      vi.mocked(updateVariant).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveUpdate = resolve;
          }),
      );

      renderVariantEditModal();

      const skuInput = screen.getByLabelText(/^sku$/i);
      await user.clear(skuInput);
      await user.type(skuInput, "KEMEJA-UPDATED");

      const submitBtn = screen.getByRole("button", {
        name: /simpan perubahan/i,
      });
      const cancelBtn = screen.getByRole("button", { name: /batal/i });

      await user.click(submitBtn);

      await waitFor(() => {
        expect(submitBtn).toBeDisabled();
        expect(submitBtn).toHaveAttribute("aria-busy", "true");
        expect(cancelBtn).toBeDisabled();
      });

      resolveUpdate({
        id: VARIANT_ID_1,
        sku: "KEMEJA-UPDATED",
        size: "M",
        color: "Hitam",
        price: 175000,
        stock: 20,
        low_stock: false,
      });

      await waitFor(() => {
        expect(submitBtn).toHaveAttribute("aria-busy", "false");
        expect(cancelBtn).toBeEnabled();
      });
    });
  });

  describe("Penanganan Error Server (applyApiErrorToForm)", () => {
    it("memetakan error SKU_DUPLICATE ke input SKU tanpa menampilkan toast", async () => {
      const user = userEvent.setup();
      vi.mocked(isApiError).mockReturnValue(true);
      vi.mocked(updateVariant).mockRejectedValue({
        code: "SKU_DUPLICATE",
        message: "SKU sudah dipakai varian lain",
      });

      renderVariantEditModal();

      const skuInput = screen.getByLabelText(/^sku$/i);
      await user.clear(skuInput);
      await user.type(skuInput, "DUP-SKU");
      await user.click(
        screen.getByRole("button", { name: /simpan perubahan/i }),
      );

      expect(
        await screen.findByText("SKU sudah dipakai varian lain"),
      ).toBeInTheDocument();
      expect(skuInput).toHaveAttribute("aria-invalid", "true");
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("memetakan error VARIANT_DUPLICATE ke banner errors.root.server", async () => {
      const user = userEvent.setup();
      vi.mocked(isApiError).mockReturnValue(true);
      vi.mocked(updateVariant).mockRejectedValue({
        code: "VARIANT_DUPLICATE",
        message: "Kombinasi ukuran L dan warna Hitam sudah terdaftar",
      });

      renderVariantEditModal();

      const sizeInput = screen.getByLabelText(/ukuran/i);
      await user.clear(sizeInput);
      await user.type(sizeInput, "L");
      await user.click(
        screen.getByRole("button", { name: /simpan perubahan/i }),
      );

      const rootAlert = await screen.findByText(
        "Kombinasi ukuran L dan warna Hitam sudah terdaftar",
      );
      expect(rootAlert).toHaveAttribute("role", "alert");
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("memetakan VALIDATION_ERROR field dikenal ke input terkait", async () => {
      const user = userEvent.setup();
      vi.mocked(isApiError).mockReturnValue(true);
      vi.mocked(updateVariant).mockRejectedValue({
        code: "VALIDATION_ERROR",
        message: "Validasi gagal",
        details: {
          errors: [
            { field: "stock", message: "Stok melebihi kapasitas gudang" },
          ],
        },
      });

      renderVariantEditModal();

      const stockInput = screen.getByLabelText(/stok/i);
      await user.clear(stockInput);
      await user.type(stockInput, "9999");
      await user.click(
        screen.getByRole("button", { name: /simpan perubahan/i }),
      );

      expect(
        await screen.findByText("Stok melebihi kapasitas gudang"),
      ).toBeInTheDocument();
      expect(stockInput).toHaveAttribute("aria-invalid", "true");
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("menampilkan toast.error jika error tidak dapat dipetakan ke form", async () => {
      const user = userEvent.setup();
      vi.mocked(isApiError).mockReturnValue(false);
      vi.mocked(getErrorMessage).mockReturnValue("Gagal memperbarui varian");
      vi.mocked(updateVariant).mockRejectedValue(new Error("Network error"));

      renderVariantEditModal();

      const skuInput = screen.getByLabelText(/^sku$/i);
      await user.clear(skuInput);
      await user.type(skuInput, "KEMEJA-ERR");
      await user.click(
        screen.getByRole("button", { name: /simpan perubahan/i }),
      );

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Gagal memperbarui varian");
      });
    });
  });
});