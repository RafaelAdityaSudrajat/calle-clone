import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createVariant,
  productKeys,
  type VariantMutationResponse,
} from "@/entities/product";
import { getErrorMessage, isApiError } from "@/shared/api";
import { VariantCreateModal } from "./variant-create-modal";

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
    createVariant: vi.fn(),
  };
});

vi.mock("@/shared/api", () => ({
  isApiError: vi.fn(),
  getErrorMessage: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : "Terjadi kesalahan",
  ),
}));

const PRODUCT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderVariantCreateModal = (
  props: Partial<React.ComponentProps<typeof VariantCreateModal>> = {},
  queryClient = createTestQueryClient(),
) => {
  const onClose = props.onClose ?? vi.fn();

  return {
    onClose,
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <VariantCreateModal
          productId={props.productId ?? PRODUCT_ID}
          open={props.open ?? true}
          onClose={onClose}
        />
      </QueryClientProvider>,
    ),
  };
};

describe("VariantCreateModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isApiError).mockReturnValue(false);
  });

  describe("Rendering & Kontrol Dialog", () => {
    it("tidak merender dialog saat open bernilai false", () => {
      renderVariantCreateModal({ open: false });

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("merender judul, deskripsi, semua field form dengan nilai default saat open bernilai true", () => {
      renderVariantCreateModal({ open: true });

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Tambah varian")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Setiap kombinasi ukuran dan warna hanya boleh ada satu.",
        ),
      ).toBeInTheDocument();

      expect(screen.getByLabelText(/^sku$/i)).toHaveValue("");
      expect(screen.getByLabelText(/ukuran/i)).toHaveValue("");
      expect(screen.getByLabelText(/warna/i)).toHaveValue("");
      expect(screen.getByLabelText(/harga \(rp\)/i)).toHaveValue(null);
      expect(screen.getByLabelText(/stok/i)).toHaveValue(0);

      expect(screen.getByRole("button", { name: /batal/i })).toBeEnabled();
      expect(screen.getByRole("button", { name: /simpan/i })).toBeEnabled();
    });

    it("memanggil onClose saat tombol Batal diklik", async () => {
      const user = userEvent.setup();
      const { onClose } = renderVariantCreateModal();

      await user.click(screen.getByRole("button", { name: /batal/i }));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(createVariant).not.toHaveBeenCalled();
    });
  });

  describe("Validasi Client-Side (Zod)", () => {
    it("menampilkan error jika SKU kosong atau hanya spasi", async () => {
      const user = userEvent.setup();
      renderVariantCreateModal();

      await user.type(screen.getByLabelText(/^sku$/i), "   ");
      await user.type(screen.getByLabelText(/ukuran/i), "M");
      await user.type(screen.getByLabelText(/harga \(rp\)/i), "150000");
      await user.click(screen.getByRole("button", { name: /simpan/i }));

      expect(await screen.findByText("SKU wajib diisi")).toBeInTheDocument();
      expect(screen.getByLabelText(/^sku$/i)).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect(createVariant).not.toHaveBeenCalled();
    });

    it("menampilkan error pada field Ukuran jika ukuran dan warna sama-sama kosong", async () => {
      const user = userEvent.setup();
      renderVariantCreateModal();

      await user.type(screen.getByLabelText(/^sku$/i), "KEMEJA-001");
      await user.type(screen.getByLabelText(/harga \(rp\)/i), "150000");
      await user.click(screen.getByRole("button", { name: /simpan/i }));

      const errorAlert = await screen.findByText(
        "Isi minimal salah satu: ukuran atau warna",
      );
      expect(errorAlert).toHaveAttribute("role", "alert");
      expect(screen.getByLabelText(/ukuran/i)).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect(createVariant).not.toHaveBeenCalled();
    });

    it("menampilkan error jika harga kosong, nol, atau negatif", async () => {
      const user = userEvent.setup();
      renderVariantCreateModal();

      await user.type(screen.getByLabelText(/^sku$/i), "KEMEJA-001");
      await user.type(screen.getByLabelText(/ukuran/i), "L");
      await user.click(screen.getByRole("button", { name: /simpan/i }));

      expect(await screen.findByText("Harga wajib diisi")).toBeInTheDocument();

      await user.type(screen.getByLabelText(/harga \(rp\)/i), "0");
      await user.click(screen.getByRole("button", { name: /simpan/i }));

      expect(
        await screen.findByText("Harga harus lebih dari 0"),
      ).toBeInTheDocument();
      expect(createVariant).not.toHaveBeenCalled();
    });

    it("menampilkan error jika stok kosong, negatif, atau bukan bilangan bulat", async () => {
      const user = userEvent.setup();
      renderVariantCreateModal();

      await user.type(screen.getByLabelText(/^sku$/i), "KEMEJA-001");
      await user.type(screen.getByLabelText(/warna/i), "Hitam");
      await user.type(screen.getByLabelText(/harga \(rp\)/i), "150000");

      const stockInput = screen.getByLabelText(/stok/i);
      await user.clear(stockInput);
      await user.click(screen.getByRole("button", { name: /simpan/i }));

      expect(await screen.findByText("Stok wajib diisi")).toBeInTheDocument();

      fireEvent.change(stockInput, { target: { value: "-5" } });
      await user.click(screen.getByRole("button", { name: /simpan/i }));
      expect(
        await screen.findByText("Stok tidak boleh negatif"),
      ).toBeInTheDocument();

      fireEvent.change(stockInput, { target: { value: "10.5" } });
      await user.click(screen.getByRole("button", { name: /simpan/i }));
      expect(
        await screen.findByText("Stok harus bilangan bulat"),
      ).toBeInTheDocument();

      expect(createVariant).not.toHaveBeenCalled();
    });
  });

  describe("Alur Submit Sukses", () => {
    it("mengirim payload varian lengkap, invalidate cache produk, tampilkan toast, dan memanggil onClose", async () => {
      const user = userEvent.setup();
      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      vi.mocked(createVariant).mockResolvedValue({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        sku: "KEMEJA-M-HTM",
        size: "M",
        color: "Hitam",
        price: 175000,
        stock: 25,
        low_stock: false,
      });

      const { onClose } = renderVariantCreateModal({}, queryClient);

      await user.type(screen.getByLabelText(/^sku$/i), "  KEMEJA-M-HTM  ");
      await user.type(screen.getByLabelText(/ukuran/i), "  M  ");
      await user.type(screen.getByLabelText(/warna/i), "  Hitam  ");
      await user.type(screen.getByLabelText(/harga \(rp\)/i), "175000");

      const stockInput = screen.getByLabelText(/stok/i);
      await user.clear(stockInput);
      await user.type(stockInput, "25");

      await user.click(screen.getByRole("button", { name: /simpan/i }));

      await waitFor(() => {
        expect(createVariant).toHaveBeenCalledWith(PRODUCT_ID, {
          sku: "KEMEJA-M-HTM",
          size: "M",
          color: "Hitam",
          price: 175000,
          stock: 25,
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: productKeys.all,
      });
      expect(toast.success).toHaveBeenCalledWith("Varian berhasil ditambahkan");
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("mengirim size atau color sebagai null jika hanya salah satu yang diisi", async () => {
      const user = userEvent.setup();
      vi.mocked(createVariant).mockResolvedValue({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        sku: "KEMEJA-PTH",
        size: null,
        color: "Putih",
        price: 150000,
        stock: 0,
        low_stock: true,
      });

      renderVariantCreateModal();

      await user.type(screen.getByLabelText(/^sku$/i), "KEMEJA-PTH");
      await user.type(screen.getByLabelText(/warna/i), "Putih");
      await user.type(screen.getByLabelText(/harga \(rp\)/i), "150000");
      await user.click(screen.getByRole("button", { name: /simpan/i }));

      await waitFor(() => {
        expect(createVariant).toHaveBeenCalledWith(PRODUCT_ID, {
          sku: "KEMEJA-PTH",
          size: null,
          color: "Putih",
          price: 150000,
          stock: 0,
        });
      });
    });

    it("menonaktifkan tombol Simpan dan Batal selama proses submit berlangsung", async () => {
      const user = userEvent.setup();
      let resolveCreate!: (value: VariantMutationResponse) => void;

      vi.mocked(createVariant).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCreate = resolve;
          }),
      );

      renderVariantCreateModal();

      await user.type(screen.getByLabelText(/^sku$/i), "KEMEJA-001");
      await user.type(screen.getByLabelText(/ukuran/i), "XL");
      await user.type(screen.getByLabelText(/harga \(rp\)/i), "200000");

      const submitBtn = screen.getByRole("button", { name: /simpan/i });
      const cancelBtn = screen.getByRole("button", { name: /batal/i });

      await user.click(submitBtn);

      await waitFor(() => {
        expect(submitBtn).toBeDisabled();
        expect(submitBtn).toHaveAttribute("aria-busy", "true");
        expect(cancelBtn).toBeDisabled();
      });

      resolveCreate({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        sku: "KEMEJA-001",
        size: "XL",
        color: null,
        price: 200000,
        stock: 0,
        low_stock: true,
      });

      await waitFor(() => {
        expect(submitBtn).toBeEnabled();
        expect(cancelBtn).toBeEnabled();
      });
    });
  });

  describe("Penanganan Error Server (applyApiErrorToForm)", () => {
    it("memetakan error SKU_DUPLICATE ke input SKU tanpa menampilkan toast", async () => {
      const user = userEvent.setup();
      vi.mocked(isApiError).mockReturnValue(true);
      vi.mocked(createVariant).mockRejectedValue({
        code: "SKU_DUPLICATE",
        message: "SKU sudah digunakan oleh produk lain",
      });

      renderVariantCreateModal();

      await user.type(screen.getByLabelText(/^sku$/i), "DUP-SKU");
      await user.type(screen.getByLabelText(/ukuran/i), "M");
      await user.type(screen.getByLabelText(/harga \(rp\)/i), "120000");
      await user.click(screen.getByRole("button", { name: /simpan/i }));

      expect(
        await screen.findByText("SKU sudah digunakan oleh produk lain"),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/^sku$/i)).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("memetakan error VARIANT_DUPLICATE ke banner errors.root.server", async () => {
      const user = userEvent.setup();
      vi.mocked(isApiError).mockReturnValue(true);
      vi.mocked(createVariant).mockRejectedValue({
        code: "VARIANT_DUPLICATE",
        message: "Kombinasi ukuran M dan warna Hitam sudah ada",
      });

      renderVariantCreateModal();

      await user.type(screen.getByLabelText(/^sku$/i), "KEMEJA-M-HTM");
      await user.type(screen.getByLabelText(/ukuran/i), "M");
      await user.type(screen.getByLabelText(/warna/i), "Hitam");
      await user.type(screen.getByLabelText(/harga \(rp\)/i), "150000");
      await user.click(screen.getByRole("button", { name: /simpan/i }));

      const rootAlert = await screen.findByText(
        "Kombinasi ukuran M dan warna Hitam sudah ada",
      );
      expect(rootAlert).toHaveAttribute("role", "alert");
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("memetakan VALIDATION_ERROR field dikenal ke input terkait", async () => {
      const user = userEvent.setup();
      vi.mocked(isApiError).mockReturnValue(true);
      vi.mocked(createVariant).mockRejectedValue({
        code: "VALIDATION_ERROR",
        message: "Validasi gagal",
        details: {
          errors: [
            { field: "price", message: "Harga tidak sesuai ketentuan toko" },
          ],
        },
      });

      renderVariantCreateModal();

      await user.type(screen.getByLabelText(/^sku$/i), "KEMEJA-001");
      await user.type(screen.getByLabelText(/ukuran/i), "S");
      await user.type(screen.getByLabelText(/harga \(rp\)/i), "100");
      await user.click(screen.getByRole("button", { name: /simpan/i }));

      expect(
        await screen.findByText("Harga tidak sesuai ketentuan toko"),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/harga \(rp\)/i)).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("menampilkan toast.error jika error tidak dapat dipetakan ke form", async () => {
      const user = userEvent.setup();
      vi.mocked(isApiError).mockReturnValue(false);
      vi.mocked(getErrorMessage).mockReturnValue("Gagal menyimpan varian");
      vi.mocked(createVariant).mockRejectedValue(new Error("Network error"));

      renderVariantCreateModal();

      await user.type(screen.getByLabelText(/^sku$/i), "KEMEJA-001");
      await user.type(screen.getByLabelText(/ukuran/i), "S");
      await user.type(screen.getByLabelText(/harga \(rp\)/i), "100000");
      await user.click(screen.getByRole("button", { name: /simpan/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Gagal menyimpan varian");
      });
    });
  });
});