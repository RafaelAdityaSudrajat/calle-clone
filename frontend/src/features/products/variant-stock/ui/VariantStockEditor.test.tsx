import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  productKeys,
  updateStock,
  type Variant,
} from "@/entities/product";
import { getErrorMessage, isApiError } from "@/shared/api";
import { VariantStockEditor } from "./variant-stock-editor";

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
    updateStock: vi.fn(),
  };
});

vi.mock("@/shared/api", () => ({
  isApiError: vi.fn(),
  getErrorMessage: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : "Terjadi kesalahan",
  ),
}));

const PRODUCT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VARIANT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type StockEditableVariant = Pick<Variant, "id" | "sku" | "stock" | "low_stock">;

const makeVariant = (
  overrides: Partial<StockEditableVariant> = {},
): StockEditableVariant => ({
  id: VARIANT_ID,
  sku: "KEMEJA-M-HTM",
  stock: 15,
  low_stock: false,
  ...overrides,
});

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderStockEditor = (
  props: Partial<React.ComponentProps<typeof VariantStockEditor>> = {},
  queryClient = createTestQueryClient(),
) => {
  const variant = props.variant ?? makeVariant();

  return {
    variant,
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <VariantStockEditor
          productId={props.productId ?? PRODUCT_ID}
          variant={variant}
        />
      </QueryClientProvider>,
    ),
  };
};

describe("VariantStockEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isApiError).mockReturnValue(false);
  });

  describe("Mode Tampilan & Indikator Badge Stok", () => {
    it("menampilkan jumlah stok dan tombol Ubah tanpa badge jika stok aman", () => {
      renderStockEditor({
        variant: makeVariant({ stock: 25, low_stock: false }),
      });

      expect(screen.getByText("25")).toBeInTheDocument();
      expect(screen.queryByText("Habis")).not.toBeInTheDocument();
      expect(screen.queryByText("Menipis")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Ubah stok KEMEJA-M-HTM" }),
      ).toBeInTheDocument();
    });

    it("menampilkan badge 'Menipis' jika stok lebih dari 0 dan low_stock bernilai true", () => {
      renderStockEditor({
        variant: makeVariant({ stock: 3, low_stock: true }),
      });

      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("Menipis")).toBeInTheDocument();
      expect(screen.queryByText("Habis")).not.toBeInTheDocument();
    });

    it("menampilkan badge 'Habis' (bukan 'Menipis') jika stok bernilai 0", () => {
      renderStockEditor({
        variant: makeVariant({ stock: 0, low_stock: true }),
      });

      expect(screen.getByText("0")).toBeInTheDocument();
      expect(screen.getByText("Habis")).toBeInTheDocument();
      expect(screen.queryByText("Menipis")).not.toBeInTheDocument();
    });
  });

  describe("Transisi Mode Edit & Kontrol Form", () => {
    it("membuka form edit dengan nilai stok awal dan tombol Simpan nonaktif saat tombol Ubah diklik", async () => {
      const user = userEvent.setup();
      renderStockEditor({ variant: makeVariant({ stock: 12 }) });

      await user.click(
        screen.getByRole("button", { name: "Ubah stok KEMEJA-M-HTM" }),
      );

      const stockInput = screen.getByLabelText("Stok KEMEJA-M-HTM");
      expect(stockInput).toHaveValue(12);
      expect(stockInput).toHaveFocus();

      expect(screen.getByRole("button", { name: /simpan/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /batal/i })).toBeEnabled();
    });

    it("kembali ke mode tampilan tanpa menyimpan saat tombol Batal diklik", async () => {
      const user = userEvent.setup();
      renderStockEditor({ variant: makeVariant({ stock: 12 }) });

      await user.click(
        screen.getByRole("button", { name: "Ubah stok KEMEJA-M-HTM" }),
      );

      const stockInput = screen.getByLabelText("Stok KEMEJA-M-HTM");
      await user.clear(stockInput);
      await user.type(stockInput, "99");

      await user.click(screen.getByRole("button", { name: /batal/i }));

      expect(screen.queryByLabelText("Stok KEMEJA-M-HTM")).not.toBeInTheDocument();
      expect(screen.getByText("12")).toBeInTheDocument();
      expect(updateStock).not.toHaveBeenCalled();
    });

    it("kembali ke mode tampilan saat tombol Escape ditekan", async () => {
      const user = userEvent.setup();
      renderStockEditor({ variant: makeVariant({ stock: 12 }) });

      await user.click(
        screen.getByRole("button", { name: "Ubah stok KEMEJA-M-HTM" }),
      );

      expect(screen.getByLabelText("Stok KEMEJA-M-HTM")).toBeInTheDocument();

      await user.keyboard("{Escape}");

      expect(screen.queryByLabelText("Stok KEMEJA-M-HTM")).not.toBeInTheDocument();
      expect(screen.getByText("12")).toBeInTheDocument();
      expect(updateStock).not.toHaveBeenCalled();
    });

    it("mengaktifkan tombol Simpan saat nilai stok diubah dan menonaktifkannya kembali jika dikembalikan ke nilai awal", async () => {
      const user = userEvent.setup();
      renderStockEditor({ variant: makeVariant({ stock: 15 }) });

      await user.click(
        screen.getByRole("button", { name: "Ubah stok KEMEJA-M-HTM" }),
      );

      const stockInput = screen.getByLabelText("Stok KEMEJA-M-HTM");
      const saveBtn = screen.getByRole("button", { name: /simpan/i });

      expect(saveBtn).toBeDisabled();

      await user.clear(stockInput);
      await user.type(stockInput, "20");
      expect(saveBtn).toBeEnabled();

      await user.clear(stockInput);
      await user.type(stockInput, "15");
      expect(saveBtn).toBeDisabled();
    });
  });

  describe("Validasi Client-Side (Zod)", () => {
    it("menampilkan error jika input stok dikosongkan", async () => {
      const user = userEvent.setup();
      renderStockEditor();

      await user.click(
        screen.getByRole("button", { name: "Ubah stok KEMEJA-M-HTM" }),
      );

      const stockInput = screen.getByLabelText("Stok KEMEJA-M-HTM");
      await user.clear(stockInput);
      await user.click(screen.getByRole("button", { name: /simpan/i }));

      expect(await screen.findByText("Stok wajib diisi")).toBeInTheDocument();
      expect(stockInput).toHaveAttribute("aria-invalid", "true");
      expect(updateStock).not.toHaveBeenCalled();
    });

    it("menampilkan error jika stok bernilai negatif, desimal, atau melebihi batas integer", async () => {
      const user = userEvent.setup();
      renderStockEditor();

      await user.click(
        screen.getByRole("button", { name: "Ubah stok KEMEJA-M-HTM" }),
      );

      const stockInput = screen.getByLabelText("Stok KEMEJA-M-HTM");
      const saveBtn = screen.getByRole("button", { name: /simpan/i });

      fireEvent.change(stockInput, { target: { value: "-1" } });
      await user.click(saveBtn);
      expect(
        await screen.findByText("Stok tidak boleh negatif"),
      ).toBeInTheDocument();

      fireEvent.change(stockInput, { target: { value: "4.5" } });
      await user.click(saveBtn);
      expect(
        await screen.findByText("Stok harus bilangan bulat"),
      ).toBeInTheDocument();

      fireEvent.change(stockInput, { target: { value: "2147483648" } });
      await user.click(saveBtn);
      expect(
        await screen.findByText("Stok terlalu besar"),
      ).toBeInTheDocument();

      expect(updateStock).not.toHaveBeenCalled();
    });
  });

  describe("Alur Simpan Stok Sukses", () => {
    it("mengirim stok baru, invalidate seluruh cache produk, tampilkan toast, dan menutup mode edit", async () => {
      const user = userEvent.setup();
      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      vi.mocked(updateStock).mockResolvedValue({
        id: VARIANT_ID,
        stock: 40,
        low_stock: false,
      });

      renderStockEditor({ variant: makeVariant({ stock: 15 }) }, queryClient);

      await user.click(
        screen.getByRole("button", { name: "Ubah stok KEMEJA-M-HTM" }),
      );

      const stockInput = screen.getByLabelText("Stok KEMEJA-M-HTM");
      await user.clear(stockInput);
      await user.type(stockInput, "40");
      await user.click(screen.getByRole("button", { name: /simpan/i }));

      await waitFor(() => {
        expect(updateStock).toHaveBeenCalledWith(PRODUCT_ID, VARIANT_ID, 40);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: productKeys.all,
      });
      expect(toast.success).toHaveBeenCalledWith("Stok diperbarui");
      expect(screen.queryByLabelText("Stok KEMEJA-M-HTM")).not.toBeInTheDocument();
    });

    it("mengizinkan pembaruan stok menjadi 0", async () => {
      const user = userEvent.setup();
      vi.mocked(updateStock).mockResolvedValue({
        id: VARIANT_ID,
        stock: 0,
        low_stock: true,
      });

      renderStockEditor({ variant: makeVariant({ stock: 10 }) });

      await user.click(
        screen.getByRole("button", { name: "Ubah stok KEMEJA-M-HTM" }),
      );

      const stockInput = screen.getByLabelText("Stok KEMEJA-M-HTM");
      await user.clear(stockInput);
      await user.type(stockInput, "0");
      await user.click(screen.getByRole("button", { name: /simpan/i }));

      await waitFor(() => {
        expect(updateStock).toHaveBeenCalledWith(PRODUCT_ID, VARIANT_ID, 0);
      });
    });

    it("menonaktifkan tombol Simpan dan Batal selama request berlangsung", async () => {
      const user = userEvent.setup();
      let resolveUpdate!: (
        value: Awaited<ReturnType<typeof updateStock>>,
      ) => void;

      vi.mocked(updateStock).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveUpdate = resolve;
          }),
      );

      renderStockEditor({ variant: makeVariant({ stock: 15 }) });

      await user.click(
        screen.getByRole("button", { name: "Ubah stok KEMEJA-M-HTM" }),
      );

      const stockInput = screen.getByLabelText("Stok KEMEJA-M-HTM");
      await user.clear(stockInput);
      await user.type(stockInput, "30");

      const saveBtn = screen.getByRole("button", { name: /simpan/i });
      const cancelBtn = screen.getByRole("button", { name: /batal/i });

      await user.click(saveBtn);

      await waitFor(() => {
        expect(saveBtn).toBeDisabled();
        expect(saveBtn).toHaveAttribute("aria-busy", "true");
        expect(cancelBtn).toBeDisabled();
      });

      resolveUpdate({
        id: VARIANT_ID,
        stock: 30,
        low_stock: false,
      });

      await waitFor(() => {
        expect(screen.queryByLabelText("Stok KEMEJA-M-HTM")).not.toBeInTheDocument();
      });
    });
  });

  describe("Penanganan Error Server", () => {
    it("memetakan error INVALID_STOCK ke input stok dan tetap mempertahankan mode edit", async () => {
      const user = userEvent.setup();
      vi.mocked(isApiError).mockReturnValue(true);
      vi.mocked(updateStock).mockRejectedValue({
        code: "INVALID_STOCK",
        message: "Stok tidak boleh kurang dari jumlah pesanan tertunda",
      });

      renderStockEditor({ variant: makeVariant({ stock: 15 }) });

      await user.click(
        screen.getByRole("button", { name: "Ubah stok KEMEJA-M-HTM" }),
      );

      const stockInput = screen.getByLabelText("Stok KEMEJA-M-HTM");
      await user.clear(stockInput);
      await user.type(stockInput, "2");
      await user.click(screen.getByRole("button", { name: /simpan/i }));

      expect(
        await screen.findByText(
          "Stok tidak boleh kurang dari jumlah pesanan tertunda",
        ),
      ).toBeInTheDocument();
      expect(stockInput).toHaveAttribute("aria-invalid", "true");
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("menampilkan toast.error dan tetap di mode edit jika terjadi error umum", async () => {
      const user = userEvent.setup();
      vi.mocked(isApiError).mockReturnValue(false);
      vi.mocked(getErrorMessage).mockReturnValue("Gagal memperbarui stok");
      vi.mocked(updateStock).mockRejectedValue(new Error("Network error"));

      renderStockEditor({ variant: makeVariant({ stock: 15 }) });

      await user.click(
        screen.getByRole("button", { name: "Ubah stok KEMEJA-M-HTM" }),
      );

      const stockInput = screen.getByLabelText("Stok KEMEJA-M-HTM");
      await user.clear(stockInput);
      await user.type(stockInput, "20");
      await user.click(screen.getByRole("button", { name: /simpan/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Gagal memperbarui stok");
      });

      expect(screen.getByLabelText("Stok KEMEJA-M-HTM")).toBeInTheDocument();
    });
  });
});