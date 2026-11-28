import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCategories } from "@/entities/category";
import {
  createProduct,
  productKeys,
  type CreateProductResponse,
} from "@/entities/product";
import { getErrorMessage, isApiError } from "@/shared/api";
import { ProductCreateForm } from "./product-create-form";

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
    createProduct: vi.fn(),
  };
});

vi.mock("@/shared/api", () => ({
  isApiError: vi.fn(),
  getErrorMessage: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : "Terjadi kesalahan",
  ),
}));

const CATEGORY_ID_1 = "11111111-1111-4111-8111-111111111111";
const CATEGORY_ID_2 = "22222222-2222-4111-8111-222222222222";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderForm = (
  props: React.ComponentProps<typeof ProductCreateForm> = {},
  queryClient = createTestQueryClient(),
) => ({
  queryClient,
  ...render(
    <QueryClientProvider client={queryClient}>
      <ProductCreateForm {...props} />
    </QueryClientProvider>,
  ),
});

describe("ProductCreateForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isApiError).mockReturnValue(false);

    vi.mocked(useCategories).mockReturnValue({
      data: [
        { id: CATEGORY_ID_1, name: "Elektronik" },
        { id: CATEGORY_ID_2, name: "Pakaian" },
      ],
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useCategories>);
  });

  describe("Rendering & State Kategori", () => {
    it("merender semua field form dan daftar opsi kategori", () => {
      renderForm();

      expect(screen.getByLabelText(/nama produk/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/deskripsi/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/kategori/i)).toBeInTheDocument();
      expect(
        screen.getByRole("option", {
          name: /belum dipilih \(wajib sebelum publish\)/i,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "Elektronik" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "Pakaian" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /simpan sebagai draft/i }),
      ).toBeInTheDocument();
    });

    it("menonaktifkan select kategori saat data kategori sedang dimuat", () => {
      vi.mocked(useCategories).mockReturnValue({
        data: undefined,
        isPending: true,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useCategories>);

      renderForm();

      expect(screen.getByLabelText(/kategori/i)).toBeDisabled();
      expect(
        screen.getByRole("option", { name: /memuat kategori/i }),
      ).toBeInTheDocument();
    });

    it("menampilkan pesan error kategori dan memanggil refetch saat tombol Coba lagi diklik", async () => {
      const user = userEvent.setup();
      const refetchMock = vi.fn();

      vi.mocked(useCategories).mockReturnValue({
        data: undefined,
        isPending: false,
        isError: true,
        error: new Error("Gagal mengambil kategori"),
        refetch: refetchMock,
      } as unknown as ReturnType<typeof useCategories>);

      renderForm();

      expect(screen.getByRole("alert")).toHaveTextContent(
        /gagal mengambil kategori/i,
      );

      await user.click(screen.getByRole("button", { name: /coba lagi/i }));
      expect(refetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("Validasi Client-Side (Zod)", () => {
    it("menampilkan error jika nama produk kosong atau hanya spasi", async () => {
      const user = userEvent.setup();
      renderForm();

      const nameInput = screen.getByLabelText(/nama produk/i);
      await user.type(nameInput, "   ");
      await user.click(
        screen.getByRole("button", { name: /simpan sebagai draft/i }),
      );

      expect(
        await screen.findByText("Nama produk wajib diisi"),
      ).toBeInTheDocument();
      expect(nameInput).toHaveAttribute("aria-invalid", "true");
      expect(createProduct).not.toHaveBeenCalled();
    });

    it("menampilkan error jika nama produk melebihi 200 karakter", async () => {
      const user = userEvent.setup();
      renderForm();

      const nameInput = screen.getByLabelText(/nama produk/i);
      fireEvent.change(nameInput, { target: { value: "a".repeat(201) } });
      await user.click(
        screen.getByRole("button", { name: /simpan sebagai draft/i }),
      );

      expect(
        await screen.findByText("Nama produk maksimal 200 karakter"),
      ).toBeInTheDocument();
      expect(createProduct).not.toHaveBeenCalled();
    });

    it("menampilkan error jika deskripsi melebihi 5000 karakter", async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText(/nama produk/i), "Produk Valid");
      fireEvent.change(screen.getByLabelText(/deskripsi/i), {
        target: { value: "b".repeat(5001) },
      });
      await user.click(
        screen.getByRole("button", { name: /simpan sebagai draft/i }),
      );

      expect(
        await screen.findByText("Deskripsi maksimal 5000 karakter"),
      ).toBeInTheDocument();
      expect(createProduct).not.toHaveBeenCalled();
    });
  });

  describe("Alur Submit Sukses", () => {
    it("mengirim payload terformat, invalidate cache, reset form, dan memanggil onSuccess", async () => {
      const user = userEvent.setup();
      const onSuccessMock = vi.fn();
      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const createdProduct = {
        id: "33333333-3333-4111-8111-333333333333",
        name: "Keyboard Mekanikal",
        description: "Switch tactile",
        category_id: CATEGORY_ID_1,
        status: "DRAFT" as const,
        created_by: "user-1",
        created_at: "2026-11-28T04:00:00.000Z",
      };

      vi.mocked(createProduct).mockResolvedValue(createdProduct);

      renderForm({ onSuccess: onSuccessMock }, queryClient);

      const nameInput = screen.getByLabelText(/nama produk/i);
      const descInput = screen.getByLabelText(/deskripsi/i);
      const categorySelect = screen.getByLabelText(/kategori/i);

      await user.type(nameInput, "  Keyboard Mekanikal  ");
      await user.type(descInput, "  Switch tactile  ");
      await user.selectOptions(categorySelect, CATEGORY_ID_1);

      await user.click(
        screen.getByRole("button", { name: /simpan sebagai draft/i }),
      );

      await waitFor(() => {
        expect(createProduct).toHaveBeenCalledWith(
          {
            name: "Keyboard Mekanikal",
            description: "Switch tactile",
            category_id: CATEGORY_ID_1,
          },
          expect.anything(),
        );
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: productKeys.lists(),
      });
      expect(toast.success).toHaveBeenCalledWith("Produk dibuat sebagai draft");
      expect(onSuccessMock).toHaveBeenCalledWith(createdProduct);

      // Form ter-reset setelah berhasil
      expect(nameInput).toHaveValue("");
      expect(descInput).toHaveValue("");
      expect(categorySelect).toHaveValue("");
    });

    it("mengirim description dan category_id sebagai null saat dikosongkan", async () => {
      const user = userEvent.setup();
      vi.mocked(createProduct).mockResolvedValue({
        id: "33333333-3333-4111-8111-333333333333",
        name: "Produk Minimal",
        description: null,
        category_id: null,
        status: "DRAFT",
        created_by: "user-1",
        created_at: "2026-11-28T04:00:00.000Z",
      });

      renderForm();

      await user.type(screen.getByLabelText(/nama produk/i), "Produk Minimal");
      await user.click(
        screen.getByRole("button", { name: /simpan sebagai draft/i }),
      );

      await waitFor(() => {
        expect(createProduct).toHaveBeenCalledWith(
          {
            name: "Produk Minimal",
            description: null,
            category_id: null,
          },
          expect.anything(),
        );
      });
    });

    it("menampilkan state loading pada tombol selama proses submit berlangsung", async () => {
      const user = userEvent.setup();
      let resolveSubmit!: (value: CreateProductResponse) => void;

      vi.mocked(createProduct).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSubmit = resolve;
          }),
      );

      renderForm();

      await user.type(screen.getByLabelText(/nama produk/i), "Produk Loading");
      await user.click(
        screen.getByRole("button", { name: /simpan sebagai draft/i }),
      );

      const loadingButton = await screen.findByRole("button", {
        name: /menyimpan/i,
      });
      expect(loadingButton).toBeDisabled();
      expect(loadingButton).toHaveAttribute("aria-busy", "true");

      resolveSubmit({
        id: "33333333-3333-4111-8111-333333333333",
        name: "Produk Loading",
        description: null,
        category_id: null,
        status: "DRAFT",
        created_by: "user-1",
        created_at: "2026-11-28T04:00:00.000Z",
      });

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /simpan sebagai draft/i }),
        ).toBeEnabled();
      });
    });
  });

  describe("Penanganan Error Server (applyApiErrorToForm)", () => {
    it("memetakan error bisnis CATEGORY_NOT_FOUND ke field kategori tanpa menampilkan toast", async () => {
      const user = userEvent.setup();
      const apiError = {
        code: "CATEGORY_NOT_FOUND",
        message: "Kategori tidak ditemukan di sistem",
      };

      vi.mocked(isApiError).mockReturnValue(true);
      vi.mocked(createProduct).mockRejectedValue(apiError);

      renderForm();

      await user.type(screen.getByLabelText(/nama produk/i), "Produk Test");
      await user.selectOptions(
        screen.getByLabelText(/kategori/i),
        CATEGORY_ID_1,
      );
      await user.click(
        screen.getByRole("button", { name: /simpan sebagai draft/i }),
      );

      expect(
        await screen.findByText("Kategori tidak ditemukan di sistem"),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/kategori/i)).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("memetakan VALIDATION_ERROR field dikenal ke input terkait", async () => {
      const user = userEvent.setup();
      const apiError = {
        code: "VALIDATION_ERROR",
        message: "Validasi gagal",
        details: {
          errors: [{ field: "name", message: "Nama produk sudah digunakan" }],
        },
      };

      vi.mocked(isApiError).mockReturnValue(true);
      vi.mocked(createProduct).mockRejectedValue(apiError);

      renderForm();

      await user.type(screen.getByLabelText(/nama produk/i), "Produk Duplikat");
      await user.click(
        screen.getByRole("button", { name: /simpan sebagai draft/i }),
      );

      expect(
        await screen.findByText("Nama produk sudah digunakan"),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/nama produk/i)).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("menampilkan banner errors.root.server untuk VALIDATION_ERROR dengan field tak dikenal", async () => {
      const user = userEvent.setup();
      const apiError = {
        code: "VALIDATION_ERROR",
        message: "Validasi gagal",
        details: {
          errors: [
            { field: "tenant_quota", message: "Kuota produk toko sudah penuh" },
          ],
        },
      };

      vi.mocked(isApiError).mockReturnValue(true);
      vi.mocked(createProduct).mockRejectedValue(apiError);

      renderForm();

      await user.type(screen.getByLabelText(/nama produk/i), "Produk Baru");
      await user.click(
        screen.getByRole("button", { name: /simpan sebagai draft/i }),
      );

      const rootAlert = await screen.findByText(
        "Kuota produk toko sudah penuh",
      );
      expect(rootAlert).toHaveAttribute("role", "alert");
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("menampilkan toast.error jika error tidak bisa dipetakan ke form", async () => {
      const user = userEvent.setup();
      const networkError = new Error("Koneksi terputus");

      vi.mocked(isApiError).mockReturnValue(false);
      vi.mocked(getErrorMessage).mockReturnValue("Koneksi terputus");
      vi.mocked(createProduct).mockRejectedValue(networkError);

      renderForm();

      await user.type(screen.getByLabelText(/nama produk/i), "Produk Baru");
      await user.click(
        screen.getByRole("button", { name: /simpan sebagai draft/i }),
      );

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Koneksi terputus");
      });
    });
  });
});
