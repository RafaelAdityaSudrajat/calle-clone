import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { productKeys, setPrimaryImage } from "@/entities/product";
import { getErrorMessage } from "@/shared/api";
import { SetPrimaryButton } from "./set-primary-button";

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
    setPrimaryImage: vi.fn(),
  };
});

vi.mock("@/shared/api", () => ({
  getErrorMessage: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : "Terjadi kesalahan",
  ),
}));

const PRODUCT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const IMAGE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderSetPrimaryButton = (
  props: Partial<React.ComponentProps<typeof SetPrimaryButton>> = {},
  queryClient = createTestQueryClient(),
) => ({
  queryClient,
  ...render(
    <QueryClientProvider client={queryClient}>
      <SetPrimaryButton
        productId={props.productId ?? PRODUCT_ID}
        imageId={props.imageId ?? IMAGE_ID}
      />
    </QueryClientProvider>,
  ),
});

describe("SetPrimaryButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merender tombol 'Jadikan utama' dalam keadaan aktif", () => {
    renderSetPrimaryButton();

    const button = screen.getByRole("button", { name: /jadikan utama/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-busy", "false");
  });

  it("mengatur gambar utama, invalidate cache produk, dan menampilkan toast saat diklik", async () => {
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    vi.mocked(setPrimaryImage).mockResolvedValue({
      id: IMAGE_ID,
      is_primary: true,
    });

    renderSetPrimaryButton({}, queryClient);

    await user.click(screen.getByRole("button", { name: /jadikan utama/i }));

    await waitFor(() => {
      expect(setPrimaryImage).toHaveBeenCalledWith(PRODUCT_ID, IMAGE_ID);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: productKeys.all,
    });
    expect(toast.success).toHaveBeenCalledWith("Gambar utama diperbarui");
  });

  it("menampilkan state loading pada tombol selama proses mutasi berlangsung", async () => {
    const user = userEvent.setup();
    let resolveSetPrimary!: (
      value: Awaited<ReturnType<typeof setPrimaryImage>>,
    ) => void;

    vi.mocked(setPrimaryImage).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSetPrimary = resolve;
        }),
    );

    renderSetPrimaryButton();

    const button = screen.getByRole("button", { name: /jadikan utama/i });
    await user.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("aria-busy", "true");
    });

    resolveSetPrimary({
      id: IMAGE_ID,
      is_primary: true,
    });

    await waitFor(() => {
      expect(button).toBeEnabled();
      expect(button).toHaveAttribute("aria-busy", "false");
    });
  });

  it("menampilkan toast.error jika gagal memperbarui gambar utama", async () => {
    const user = userEvent.setup();
    vi.mocked(getErrorMessage).mockReturnValue("Gambar tidak ditemukan");
    vi.mocked(setPrimaryImage).mockRejectedValue(
      new Error("Gambar tidak ditemukan"),
    );

    renderSetPrimaryButton();

    await user.click(screen.getByRole("button", { name: /jadikan utama/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Gambar tidak ditemukan");
    });
  });
});