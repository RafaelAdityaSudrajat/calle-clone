import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPublishFailureLabel,
  getPublishFailures,
  getPublishReadiness,
  productKeys,
  publishProduct,
  republishProduct,
  unpublishProduct,
  type ProductDetail,
  type PublishFailure,
  type StatusChangeResponse,
} from "@/entities/product";
import { getErrorMessage } from "@/shared/api";
import { ProductStatusPanel } from "./product-status-panel";

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
    publishProduct: vi.fn(),
    republishProduct: vi.fn(),
    unpublishProduct: vi.fn(),
    getPublishReadiness: vi.fn(),
    getPublishFailures: vi.fn(),
    getPublishFailureLabel: vi.fn(),
  };
});

vi.mock("@/shared/api", () => ({
  getErrorMessage: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : "Terjadi kesalahan",
  ),
}));

const PRODUCT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const makeProduct = (overrides: Partial<ProductDetail> = {}): ProductDetail => ({
  id: PRODUCT_ID,
  name: "Kemeja Linen",
  description: "Bahan adem untuk harian",
  category: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Pakaian",
  },
  status: "DRAFT",
  variants: [],
  images: [],
  created_by: "user-1",
  updated_by: "user-1",
  created_at: "2026-11-28T04:00:00.000Z",
  updated_at: "2026-11-28T04:00:00.000Z",
  ...overrides,
});

const makeFailure = (code: string): PublishFailure =>
  ({ code }) as unknown as PublishFailure;

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderStatusPanel = (
  product: ProductDetail = makeProduct(),
  queryClient = createTestQueryClient(),
) => ({
  queryClient,
  ...render(
    <QueryClientProvider client={queryClient}>
      <ProductStatusPanel product={product} />
    </QueryClientProvider>,
  ),
});

describe("ProductStatusPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPublishReadiness).mockReturnValue([]);
    vi.mocked(getPublishFailures).mockReturnValue([]);
    vi.mocked(getPublishFailureLabel).mockImplementation(
      (failure) => `Syarat: ${failure.code}`,
    );
  });

  describe("Tampilan Berdasarkan Status Produk", () => {
    it("menampilkan hint dan tombol 'Publikasikan' untuk produk DRAFT", () => {
      renderStatusPanel(makeProduct({ status: "DRAFT" }));

      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Belum tampil di toko. Lengkapi syaratnya, lalu publikasikan.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /^publikasikan$/i }),
      ).toBeInTheDocument();
    });

    it("menampilkan hint dan tombol 'Publikasikan ulang' untuk produk INACTIVE", () => {
      renderStatusPanel(makeProduct({ status: "INACTIVE" }));

      expect(
        screen.getByText("Produk disembunyikan dari toko."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /publikasikan ulang/i }),
      ).toBeInTheDocument();
    });

    it("menampilkan hint dan tombol 'Nonaktifkan' untuk produk ACTIVE serta menyembunyikan checklist", () => {
      vi.mocked(getPublishReadiness).mockReturnValue([
        makeFailure("NO_VARIANTS"),
      ]);

      renderStatusPanel(makeProduct({ status: "ACTIVE" }));

      expect(
        screen.getByText("Produk sedang tampil di toko."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /nonaktifkan/i }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  describe("Checklist Syarat Publikasi (Client Readiness vs Server Failures)", () => {
    it("menampilkan daftar syarat dari getPublishReadiness jika produk DRAFT belum siap", () => {
      vi.mocked(getPublishReadiness).mockReturnValue([
        makeFailure("MISSING_CATEGORY"),
        makeFailure("NO_ACTIVE_VARIANT"),
      ]);

      renderStatusPanel(makeProduct({ status: "DRAFT" }));

      const checklist = screen.getByRole("status");
      expect(checklist).toHaveTextContent("Belum bisa dipublikasikan:");
      expect(checklist).toHaveTextContent("Syarat: MISSING_CATEGORY");
      expect(checklist).toHaveTextContent("Syarat: NO_ACTIVE_VARIANT");
    });

    it("menyembunyikan box checklist jika semua syarat klien sudah terpenuhi", () => {
      vi.mocked(getPublishReadiness).mockReturnValue([]);

      renderStatusPanel(makeProduct({ status: "DRAFT" }));

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("mengganti checklist klien dengan daftar kegagalan otoritatif dari server saat publish ditolak", async () => {
      const user = userEvent.setup();
      vi.mocked(getPublishReadiness).mockReturnValue([
        makeFailure("CLIENT_CHECK"),
      ]);
      vi.mocked(getPublishFailures).mockReturnValue([
        makeFailure("SERVER_STOCK_EMPTY"),
        makeFailure("SERVER_IMAGE_MISSING"),
      ]);
      vi.mocked(publishProduct).mockRejectedValue(
        new Error("Syarat belum lengkap"),
      );

      renderStatusPanel(makeProduct({ status: "DRAFT" }));

      expect(screen.getByText("Syarat: CLIENT_CHECK")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /^publikasikan$/i }));

      await waitFor(() => {
        expect(
          screen.getByText("Syarat: SERVER_STOCK_EMPTY"),
        ).toBeInTheDocument();
      });

      expect(
        screen.getByText("Syarat: SERVER_IMAGE_MISSING"),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Syarat: CLIENT_CHECK"),
      ).not.toBeInTheDocument();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("mereset serverFailures ketika tombol aksi diklik kembali", async () => {
      const user = userEvent.setup();
      vi.mocked(getPublishReadiness).mockReturnValue([]);
      vi.mocked(getPublishFailures).mockReturnValueOnce([
        makeFailure("SERVER_BLOCKED"),
      ]);
      vi.mocked(publishProduct)
        .mockRejectedValueOnce(new Error("Ditolak"))
        .mockResolvedValueOnce({ id: PRODUCT_ID, status: "ACTIVE" });

      renderStatusPanel(makeProduct({ status: "DRAFT" }));

      const publishBtn = screen.getByRole("button", { name: /^publikasikan$/i });

      // Klik pertama: server menolak dan menampilkan checklist error server
      await user.click(publishBtn);
      expect(
        await screen.findByText("Syarat: SERVER_BLOCKED"),
      ).toBeInTheDocument();

      // Klik kedua: serverFailures di-reset sebelum mutasi dijalankan
      await user.click(publishBtn);
      await waitFor(() => {
        expect(
          screen.queryByText("Syarat: SERVER_BLOCKED"),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Alur Perubahan Status Sukses", () => {
    it("memanggil publishProduct, invalidate cache, dan menampilkan toast saat klik Publikasikan", async () => {
      const user = userEvent.setup();
      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      vi.mocked(publishProduct).mockResolvedValue({
        id: PRODUCT_ID,
        status: "ACTIVE",
      });

      renderStatusPanel(makeProduct({ status: "DRAFT" }), queryClient);

      await user.click(screen.getByRole("button", { name: /^publikasikan$/i }));

      await waitFor(() => {
        expect(publishProduct).toHaveBeenCalledWith(PRODUCT_ID);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: productKeys.all,
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Produk berhasil dipublikasikan",
      );
    });

    it("memanggil republishProduct, invalidate cache, dan menampilkan toast saat klik Publikasikan ulang", async () => {
      const user = userEvent.setup();
      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      vi.mocked(republishProduct).mockResolvedValue({
        id: PRODUCT_ID,
        status: "ACTIVE",
      });

      renderStatusPanel(makeProduct({ status: "INACTIVE" }), queryClient);

      await user.click(
        screen.getByRole("button", { name: /publikasikan ulang/i }),
      );

      await waitFor(() => {
        expect(republishProduct).toHaveBeenCalledWith(PRODUCT_ID);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: productKeys.all,
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Produk berhasil dipublikasikan ulang",
      );
    });

    it("memanggil unpublishProduct, invalidate cache, dan menampilkan toast saat klik Nonaktifkan", async () => {
      const user = userEvent.setup();
      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      vi.mocked(unpublishProduct).mockResolvedValue({
        id: PRODUCT_ID,
        status: "INACTIVE",
      });

      renderStatusPanel(makeProduct({ status: "ACTIVE" }), queryClient);

      await user.click(screen.getByRole("button", { name: /nonaktifkan/i }));

      await waitFor(() => {
        expect(unpublishProduct).toHaveBeenCalledWith(PRODUCT_ID);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: productKeys.all,
      });
      expect(toast.success).toHaveBeenCalledWith("Produk dinonaktifkan");
    });

    it("menampilkan state loading pada tombol selama proses mutasi berlangsung", async () => {
      const user = userEvent.setup();
      let resolvePublish!: (value: StatusChangeResponse) => void;

      vi.mocked(publishProduct).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePublish = resolve;
          }),
      );

      renderStatusPanel(makeProduct({ status: "DRAFT" }));

      const btn = screen.getByRole("button", { name: /^publikasikan$/i });
      await user.click(btn);

      await waitFor(() => {
        expect(btn).toBeDisabled();
        expect(btn).toHaveAttribute("aria-busy", "true");
      });

      resolvePublish({ id: PRODUCT_ID, status: "ACTIVE" });

      await waitFor(() => {
        expect(btn).toBeEnabled();
        expect(btn).toHaveAttribute("aria-busy", "false");
      });
    });
  });

  describe("Penanganan Error Umum", () => {
    it("menampilkan toast.error jika error bukan kegagalan syarat publikasi", async () => {
      const user = userEvent.setup();
      vi.mocked(getPublishFailures).mockReturnValue([]);
      vi.mocked(getErrorMessage).mockReturnValue("Server sedang gangguan");
      vi.mocked(publishProduct).mockRejectedValue(
        new Error("Server sedang gangguan"),
      );

      renderStatusPanel(makeProduct({ status: "DRAFT" }));

      await user.click(screen.getByRole("button", { name: /^publikasikan$/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Server sedang gangguan");
      });
    });
  });
});