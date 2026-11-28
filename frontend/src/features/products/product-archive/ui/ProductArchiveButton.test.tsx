import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { archiveProduct, productKeys } from "@/entities/product";
import { getErrorMessage } from "@/shared/api";
import { ProductArchiveButton } from "./product-archive-button";

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
    archiveProduct: vi.fn(),
  };
});

vi.mock("@/shared/api", () => ({
  getErrorMessage: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : "Terjadi kesalahan",
  ),
}));

const PRODUCT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PRODUCT_NAME = "Kemeja Linen";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderArchiveButton = (
  props: Partial<React.ComponentProps<typeof ProductArchiveButton>> = {},
  queryClient = createTestQueryClient(),
) => ({
  queryClient,
  ...render(
    <QueryClientProvider client={queryClient}>
      <ProductArchiveButton
        productId={props.productId ?? PRODUCT_ID}
        productName={props.productName ?? PRODUCT_NAME}
        onArchived={props.onArchived}
      />
    </QueryClientProvider>,
  ),
});

describe("ProductArchiveButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merender tombol pemicu dan menyembunyikan dialog konfirmasi di awal", () => {
    renderArchiveButton();

    expect(
      screen.getByRole("button", { name: /arsipkan produk/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("membuka dialog konfirmasi dengan nama produk dan menutupnya saat klik Batal", async () => {
    const user = userEvent.setup();
    renderArchiveButton();

    await user.click(screen.getByRole("button", { name: /arsipkan produk/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Arsipkan produk?")).toBeInTheDocument();
    expect(
      screen.getByText(
        `"${PRODUCT_NAME}" akan diarsipkan dan tidak dapat dipulihkan dari aplikasi.`,
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /batal/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(archiveProduct).not.toHaveBeenCalled();
  });

  it("mengarsipkan produk, invalidate cache, menutup dialog, dan memanggil onArchived saat konfirmasi", async () => {
    const user = userEvent.setup();
    const onArchivedMock = vi.fn();
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    vi.mocked(archiveProduct).mockResolvedValue(undefined);

    renderArchiveButton({ onArchived: onArchivedMock }, queryClient);

    await user.click(screen.getByRole("button", { name: /arsipkan produk/i }));
    await user.click(screen.getByRole("button", { name: /^arsipkan$/i }));

    await waitFor(() => {
      expect(archiveProduct).toHaveBeenCalledWith(
        PRODUCT_ID,
        expect.anything(),
      );
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: productKeys.all,
    });
    expect(toast.success).toHaveBeenCalledWith("Produk diarsipkan");
    expect(onArchivedMock).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("menonaktifkan tombol Batal dan Arsipkan selama proses request berlangsung", async () => {
    const user = userEvent.setup();
    let resolveArchive!: () => void;

    vi.mocked(archiveProduct).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveArchive = resolve;
        }),
    );

    renderArchiveButton();

    await user.click(screen.getByRole("button", { name: /arsipkan produk/i }));

    const confirmBtn = screen.getByRole("button", { name: /^arsipkan$/i });
    const cancelBtn = screen.getByRole("button", { name: /batal/i });

    await user.click(confirmBtn);

    await waitFor(() => {
      expect(confirmBtn).toBeDisabled();
      expect(confirmBtn).toHaveAttribute("aria-busy", "true");
      expect(cancelBtn).toBeDisabled();
    });

    resolveArchive();

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("menampilkan toast.error dan membiarkan dialog tetap terbuka jika gagal mengarsipkan", async () => {
    const user = userEvent.setup();
    const onArchivedMock = vi.fn();

    vi.mocked(getErrorMessage).mockReturnValue(
      "Produk masih terhubung dengan transaksi",
    );
    vi.mocked(archiveProduct).mockRejectedValue(
      new Error("Produk masih terhubung dengan transaksi"),
    );

    renderArchiveButton({ onArchived: onArchivedMock });

    await user.click(screen.getByRole("button", { name: /arsipkan produk/i }));
    await user.click(screen.getByRole("button", { name: /^arsipkan$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Produk masih terhubung dengan transaksi",
      );
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onArchivedMock).not.toHaveBeenCalled();
  });
});