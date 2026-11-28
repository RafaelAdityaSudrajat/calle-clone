import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCategories } from "@/entities/category";
import {
  productKeys,
  updateProduct,
  type ProductDetail,
} from "@/entities/product";
import { getErrorMessage, isApiError } from "@/shared/api";
import { ProductEditForm } from "./product-edit-form";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/entities/category", () => ({
  useCategories: vi.fn(),
}));

vi.mock("@/entities/product", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/entities/product")>();
  return {
    ...actual,
    updateProduct: vi.fn(),
  };
});

vi.mock("@/shared/api", () => ({
  isApiError: vi.fn(),
  getErrorMessage: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : "Terjadi kesalahan",
  ),
}));

const PRODUCT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CATEGORY_ID_1 = "11111111-1111-4111-8111-111111111111";
const CATEGORY_ID_2 = "22222222-2222-4111-8111-222222222222";

const makeProduct = (overrides: Partial<ProductDetail> = {}): ProductDetail => ({
  id: PRODUCT_ID,
  name: "Kemeja Linen",
  description: "Bahan adem untuk harian",
  category: { id: CATEGORY_ID_1, name: "Pakaian" },
  status: "DRAFT",
  variants: [],
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

const renderEditForm = (
  props: Partial<React.ComponentProps<typeof ProductEditForm>> = {},
  queryClient = createTestQueryClient(),
) => {
  const product = props.product ?? makeProduct();

  return {
    product,
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <ProductEditForm product={product} onSuccess={props.onSuccess} />
      </QueryClientProvider>,
    ),
  };
};

describe("ProductEditForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isApiError).mockReturnValue(false);

    vi.mocked(useCategories).mockReturnValue({
      data: [
        { id: CATEGORY_ID_1, name: "Pakaian" },
        { id: CATEGORY_ID_2, name: "Elektronik" },
      ],
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useCategories>);
  });

  describe("Inisialisasi Data & Status Dirty", () => {
    it("mengisi field awal sesuai data produk dan menonaktifkan tombol submit saat belum ada perubahan", () => {
      renderEditForm();

      expect(screen.getByLabelText(/nama produk/i)).toHaveValue("Kemeja Linen");
      expect(screen.getByLabelText(/deskripsi/i)).toHaveValue(
        "Bahan adem untuk harian",
      );
      expect(screen.getByLabelText(/kategori/i)).toHaveValue(CATEGORY_ID_1);

      expect(
        screen.getByRole("button", { name: /simpan perubahan/i }),
      ).toBeDisabled();
    });

    it("mengisi string kosong jika description dan category bernilai null", () => {
      renderEditForm({
        product: makeProduct({ description: null, category: null }),
      });

      expect(screen.getByLabelText(/deskripsi/i)).toHaveValue("");
      expect(screen.getByLabelText(/kategori/i)).toHaveValue("");
    });

    it("mengaktifkan tombol submit saat field diubah dan menonaktifkannya lagi jika dikembalikan ke nilai awal", async () => {
      const user = userEvent.setup();
      renderEditForm();

      const nameInput = screen.getByLabelText(/nama produk/i);
      const submitBtn = screen.getByRole("button", { name: /simpan perubahan/i });

      expect(submitBtn).toBeDisabled();

      await user.clear(nameInput);
      await user.type(nameInput, "Kemeja Katun");
      expect(submitBtn).toBeEnabled();

      await user.clear(nameInput);
      await user.type(nameInput, "Kemeja Linen");
      expect(submitBtn).toBeDisabled();
    });
  });

  describe("Kategori & Aturan Status Produk (BR-24)", () => {
    it("tetap menampilkan opsi kategori produk saat ini ketika daftar kategori masih dimuat", () => {
      vi.mocked(useCategories).mockReturnValue({
        data: undefined,
        isPending: true,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useCategories>);

      renderEditForm();

      const categorySelect = screen.getByLabelText(/kategori/i);
      expect(categorySelect).toHaveValue(CATEGORY_ID_1);
      expect(screen.getByRole("option", { name: "Pakaian" })).toBeInTheDocument();
    });

    it("menonaktifkan opsi 'Belum dipilih' jika status produk adalah ACTIVE", () => {
      renderEditForm({
        product: makeProduct({ status: "ACTIVE" }),
      });

      const emptyOption = screen.getByRole("option", {
        name: "Belum dipilih",
      }) as HTMLOptionElement;
      expect(emptyOption.disabled).toBe(true);
    });

    it("mengizinkan opsi 'Belum dipilih' jika status produk DRAFT atau INACTIVE", () => {
      renderEditForm({
        product: makeProduct({ status: "DRAFT" }),
      });

      const emptyOption = screen.getByRole("option", {
        name: "Belum dipilih",
      }) as HTMLOptionElement;
      expect(emptyOption.disabled).toBe(false);
    });

    it("menampilkan pesan error kategori dan memanggil refetch saat tombol Coba lagi diklik", async () => {
      const user = userEvent.setup();
      const refetchMock = vi.fn();

      vi.mocked(useCategories).mockReturnValue({
        data: undefined,
        isPending: false,
        isError: true,
        error: new Error("Gagal memuat kategori"),
        refetch: refetchMock,
      } as unknown as ReturnType<typeof useCategories>);

      renderEditForm();

      expect(screen.getByRole("alert")).toHaveTextContent(/gagal memuat kategori/i);

      await user.click(screen.getByRole("button", { name: /coba lagi/i }));
      expect(refetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("Validasi Client-Side (Zod)", () => {
    it("menampilkan error jika nama produk dikosongkan", async () => {
      const user = userEvent.setup();
      renderEditForm();

      const nameInput = screen.getByLabelText(/nama produk/i);
      await user.clear(nameInput);
      await user.click(screen.getByRole("button", { name: /simpan perubahan/i }));

      expect(await screen.findByText("Nama produk wajib diisi")).toBeInTheDocument();
      expect(nameInput).toHaveAttribute("aria-invalid", "true");
      expect(updateProduct).not.toHaveBeenCalled();
    });

    it("menampilkan error jika nama produk melebihi 200 karakter", async () => {
      const user = userEvent.setup();
      renderEditForm();

      const nameInput = screen.getByLabelText(/nama produk/i);
      fireEvent.change(nameInput, { target: { value: "a".repeat(201) } });
      await user.click(screen.getByRole("button", { name: /simpan perubahan/i }));

      expect(
        await screen.findByText("Nama produk maksimal 200 karakter"),
      ).toBeInTheDocument();
      expect(updateProduct).not.toHaveBeenCalled();
    });

    it("menampilkan error jika deskripsi melebihi 5000 karakter", async () => {
      const user = userEvent.setup();
      renderEditForm();

      const descInput = screen.getByLabelText(/deskripsi/i);
      fireEvent.change(descInput, { target: { value: "b".repeat(5001) } });
      await user.click(screen.getByRole("button", { name: /simpan perubahan/i }));

      expect(
        await screen.findByText("Deskripsi maksimal 5000 karakter"),
      ).toBeInTheDocument();
      expect(updateProduct).not.toHaveBeenCalled();
    });
  });

  describe("Alur Submit Sukses", () => {
    it("mengirim payload perubahan, invalidate seluruh cache produk, mereset baseline dirty, dan memanggil onSuccess", async () => {
      const user = userEvent.setup();
      const onSuccessMock = vi.fn();
      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      vi.mocked(updateProduct).mockResolvedValue({
        id: PRODUCT_ID,
        name: "Kemeja Linen Premium",
        description: "Edisi terbaru",
        category_id: CATEGORY_ID_2,
        status: "DRAFT",
        updated_by: "user-1",
        updated_at: "2026-11-28T05:00:00.000Z",
      });

      renderEditForm({ onSuccess: onSuccessMock }, queryClient);

      const nameInput = screen.getByLabelText(/nama produk/i);
      const descInput = screen.getByLabelText(/deskripsi/i);
      const categorySelect = screen.getByLabelText(/kategori/i);
      const submitBtn = screen.getByRole("button", { name: /simpan perubahan/i });

      await user.clear(nameInput);
      await user.type(nameInput, "  Kemeja Linen Premium  ");
      await user.clear(descInput);
      await user.type(descInput, "  Edisi terbaru  ");
      await user.selectOptions(categorySelect, CATEGORY_ID_2);

      await user.click(submitBtn);

      await waitFor(() => {
        expect(updateProduct).toHaveBeenCalledWith(PRODUCT_ID, {
          name: "Kemeja Linen Premium",
          description: "Edisi terbaru",
          category_id: CATEGORY_ID_2,
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: productKeys.all,
      });
      expect(toast.success).toHaveBeenCalledWith("Produk berhasil diperbarui");
      expect(onSuccessMock).toHaveBeenCalledTimes(1);

      // Nilai tersimpan tetap tampil, tetapi tombol kembali disabled karena isDirty reset ke false
      expect(nameInput).toHaveValue("Kemeja Linen Premium");
      expect(submitBtn).toBeDisabled();
    });

    it("mengirim description dan category_id sebagai null saat dikosongkan pada produk DRAFT", async () => {
      const user = userEvent.setup();

      vi.mocked(updateProduct).mockResolvedValue({
        id: PRODUCT_ID,
        name: "Kemeja Linen",
        description: null,
        category_id: null,
        status: "DRAFT",
        updated_by: "user-1",
        updated_at: "2026-11-28T05:00:00.000Z",
      });

      renderEditForm();

      await user.clear(screen.getByLabelText(/deskripsi/i));
      await user.selectOptions(screen.getByLabelText(/kategori/i), "");
      await user.click(screen.getByRole("button", { name: /simpan perubahan/i }));

      await waitFor(() => {
        expect(updateProduct).toHaveBeenCalledWith(PRODUCT_ID, {
          name: "Kemeja Linen",
          description: null,
          category_id: null,
        });
      });
    });

    it("menampilkan state loading pada tombol selama proses simpan berlangsung", async () => {
      const user = userEvent.setup();
      let resolveSubmit!: (
        value: Awaited<ReturnType<typeof updateProduct>>,
      ) => void;

      vi.mocked(updateProduct).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSubmit = resolve;
          }),
      );

      renderEditForm();

      const nameInput = screen.getByLabelText(/nama produk/i);
      await user.clear(nameInput);
      await user.type(nameInput, "Kemeja Baru");

      const submitBtn = screen.getByRole("button", { name: /simpan perubahan/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(submitBtn).toBeDisabled();
        expect(submitBtn).toHaveAttribute("aria-busy", "true");
      });

      resolveSubmit({
        id: PRODUCT_ID,
        name: "Kemeja Baru",
        description: "Bahan adem untuk harian",
        category_id: CATEGORY_ID_1,
        status: "DRAFT",
        updated_by: "user-1",
        updated_at: "2026-11-28T05:00:00.000Z",
      });

      await waitFor(() => {
        expect(submitBtn).toHaveAttribute("aria-busy", "false");
      });
    });
  });

  describe("Penanganan Error Server (applyApiErrorToForm)", () => {
    it("memetakan error bisnis CATEGORY_REQUIRED ke field kategori tanpa menampilkan toast", async () => {
      const user = userEvent.setup();
      vi.mocked(isApiError).mockReturnValue(true);
      vi.mocked(updateProduct).mockRejectedValue({
        code: "CATEGORY_REQUIRED",
        message: "Kategori wajib dipilih untuk produk aktif",
      });

      renderEditForm();

      await user.selectOptions(screen.getByLabelText(/kategori/i), "");
      await user.click(screen.getByRole("button", { name: /simpan perubahan/i }));

      expect(
        await screen.findByText("Kategori wajib dipilih untuk produk aktif"),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/kategori/i)).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("memetakan VALIDATION_ERROR field dikenal ke input terkait", async () => {
      const user = userEvent.setup();
      vi.mocked(isApiError).mockReturnValue(true);
      vi.mocked(updateProduct).mockRejectedValue({
        code: "VALIDATION_ERROR",
        message: "Validasi gagal",
        details: {
          errors: [{ field: "name", message: "Nama produk sudah dipakai" }],
        },
      });

      renderEditForm();

      const nameInput = screen.getByLabelText(/nama produk/i);
      await user.clear(nameInput);
      await user.type(nameInput, "Kemeja Duplikat");
      await user.click(screen.getByRole("button", { name: /simpan perubahan/i }));

      expect(
        await screen.findByText("Nama produk sudah dipakai"),
      ).toBeInTheDocument();
      expect(nameInput).toHaveAttribute("aria-invalid", "true");
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("menampilkan banner errors.root.server untuk VALIDATION_ERROR dengan field tak dikenal", async () => {
      const user = userEvent.setup();
      vi.mocked(isApiError).mockReturnValue(true);
      vi.mocked(updateProduct).mockRejectedValue({
        code: "VALIDATION_ERROR",
        message: "Validasi gagal",
        details: {
          errors: [
            { field: "status", message: "Produk terarsip tidak dapat diubah" },
          ],
        },
      });

      renderEditForm();

      const nameInput = screen.getByLabelText(/nama produk/i);
      await user.clear(nameInput);
      await user.type(nameInput, "Kemeja Terkunci");
      await user.click(screen.getByRole("button", { name: /simpan perubahan/i }));

      const rootAlert = await screen.findByText(
        "Produk terarsip tidak dapat diubah",
      );
      expect(rootAlert).toHaveAttribute("role", "alert");
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("menampilkan toast.error jika error tidak bisa dipetakan ke form", async () => {
      const user = userEvent.setup();
      vi.mocked(isApiError).mockReturnValue(false);
      vi.mocked(getErrorMessage).mockReturnValue("Gagal menghubungi server");
      vi.mocked(updateProduct).mockRejectedValue(new Error("Network error"));

      renderEditForm();

      const nameInput = screen.getByLabelText(/nama produk/i);
      await user.clear(nameInput);
      await user.type(nameInput, "Kemeja Baru");
      await user.click(screen.getByRole("button", { name: /simpan perubahan/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Gagal menghubungi server");
      });
    });
  });
});