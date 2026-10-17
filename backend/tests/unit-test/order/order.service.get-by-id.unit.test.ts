import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "../../../src/generated/prisma";
import { OrderErrors } from "../../../src/modules/order/order.errors";
import { getOrderByIdService } from "../../../src/modules/order/order.service";

/**
 * getOrderByIdService hanya membutuhkan satu query READ:
 *   - prisma.order.findFirst
 *
 * Query tersebut sekaligus memverifikasi:
 *   - order.id sesuai parameter.
 *   - order.userId sesuai user yang sedang login.
 *   - items diurutkan berdasarkan createdAt ASC.
 *
 * Tidak perlu mock $transaction karena service ini hanya membaca data.
 *
 * vi.hoisted dipakai agar mock tersedia saat factory vi.mock
 * yang di-hoist oleh Vitest dijalankan.
 */
const mocks = vi.hoisted(() => ({
  order: {
    findFirst: vi.fn(),
  },
}));

vi.mock("../../../src/lib/prisma", () => ({
  prisma: {
    order: mocks.order,
  },
}));

const { order } = mocks;

// ------------------------------------------------------------------
// Builder
// ------------------------------------------------------------------

type OrderItemFixture = {
  id: string;
  productVariantId: string;
  productName: string;
  variantSku: string;
  unitPrice: Prisma.Decimal;
  quantity: number;
  subtotal: Prisma.Decimal;
  createdAt: Date;
};

type OrderFixture = {
  id: string;
  status: "PENDING_PAYMENT" | "PAID" | "CANCELLED";
  paymentStatus: "UNPAID" | "PAID" | "FAILED" | "REFUNDED";
  totalAmount: Prisma.Decimal;
  shippingRecipientName: string;
  shippingPhone: string;
  shippingAddressLine: string;
  shippingCity: string;
  shippingPostalCode: string;
  createdAt: Date;
  updatedAt: Date;
  paidAt: Date | null;
  items: OrderItemFixture[];
};

function buildOrder(overrides: Partial<OrderFixture> = {}): OrderFixture {
  const defaultOrder: OrderFixture = {
    id: "order-123",
    status: "PAID",
    paymentStatus: "PAID",
    totalAmount: new Prisma.Decimal("300000.00"),

    shippingRecipientName: "Budi",
    shippingPhone: "08123456789",
    shippingAddressLine: "Jl. Merdeka No. 1",
    shippingCity: "Jakarta",
    shippingPostalCode: "12345",

    createdAt: new Date("2026-10-13T12:00:00.000Z"),
    updatedAt: new Date("2026-10-13T13:00:00.000Z"),
    paidAt: new Date("2026-10-13T12:30:00.000Z"),

    items: [
      {
        id: "order-item-1",
        productVariantId: "variant-1",
        productName: "Kaos Hitam",
        variantSku: "KAOS-HITAM-L",
        unitPrice: new Prisma.Decimal("100000.00"),
        quantity: 2,
        subtotal: new Prisma.Decimal("200000.00"),
        createdAt: new Date("2026-10-13T12:00:01.000Z"),
      },
      {
        id: "order-item-2",
        productVariantId: "variant-2",
        productName: "Celana Chino",
        variantSku: "CHINO-BEIGE-M",
        unitPrice: new Prisma.Decimal("50000.00"),
        quantity: 2,
        subtotal: new Prisma.Decimal("100000.00"),
        createdAt: new Date("2026-10-13T12:00:02.000Z"),
      },
    ],
  };

  return {
    ...defaultOrder,
    ...overrides,
  };
}

// ------------------------------------------------------------------
// Setup
// ------------------------------------------------------------------

describe("getOrderByIdService", () => {
  beforeEach(() => {
    // Pulihkan spy dari test sebelumnya sebelum menyiapkan test baru.
    vi.restoreAllMocks();
    vi.clearAllMocks();

    order.findFirst.mockResolvedValue(null);
  });

  // ----------------------------------------------------------------
  // Query contract & anti-IDOR
  // ----------------------------------------------------------------

  describe("isolasi data (anti-IDOR)", () => {
    it("selalu memfilter order berdasarkan id DAN userId", async () => {
      order.findFirst.mockResolvedValue(buildOrder());

      await getOrderByIdService("user-42", "order-123");

      expect(order.findFirst).toHaveBeenCalledWith({
        where: {
          id: "order-123",
          userId: "user-42",
        },
        include: {
          items: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });
    });

    it("menggunakan findFirst, bukan findUnique untuk mengambil order", async () => {
      order.findFirst.mockResolvedValue(buildOrder());

      await getOrderByIdService("user-42", "order-123");

      expect(order.findFirst).toHaveBeenCalledTimes(1);

      // Mock hanya menyediakan findFirst.
      // Assertion ini mendokumentasikan kontrak query yang digunakan.
      expect(order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "order-123",
            userId: "user-42",
          },
        }),
      );
    });

    it("tidak membocorkan field internal order", async () => {
      order.findFirst.mockResolvedValue({
        ...buildOrder(),
        userId: "user-42",
        idempotencyKey: "key-1",
      });

      const result = await getOrderByIdService("user-42", "order-123");

      expect(result).not.toHaveProperty("userId");
      expect(result).not.toHaveProperty("user_id");
      expect(result).not.toHaveProperty("idempotency_key");
    });
  });

  // ----------------------------------------------------------------
  // Relasi & urutan item
  // ----------------------------------------------------------------

  describe("query items", () => {
    it("mengambil relasi items dengan urutan createdAt ASC", async () => {
      order.findFirst.mockResolvedValue(buildOrder());

      await getOrderByIdService("user-42", "order-123");

      expect(order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            items: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        }),
      );
    });
  });

  // ----------------------------------------------------------------
  // Mapping response DTO
  // ----------------------------------------------------------------

  describe("mapping response DTO", () => {
    it("memetakan order dan items ke DTO dengan benar", async () => {
      order.findFirst.mockResolvedValue(buildOrder());

      const result = await getOrderByIdService("user-42", "order-123");

      expect(result).toEqual({
        id: "order-123",
        status: "PAID",
        payment_status: "PAID",
        total_amount: "300000.00",

        shipping_address: {
          recipient_name: "Budi",
          phone: "08123456789",
          address_line: "Jl. Merdeka No. 1",
          city: "Jakarta",
          postal_code: "12345",
        },

        items: [
          {
            id: "order-item-1",
            product_variant_id: "variant-1",
            product_name: "Kaos Hitam",
            variant_sku: "KAOS-HITAM-L",
            unit_price: "100000.00",
            quantity: 2,
            subtotal: "200000.00",
          },
          {
            id: "order-item-2",
            product_variant_id: "variant-2",
            product_name: "Celana Chino",
            variant_sku: "CHINO-BEIGE-M",
            unit_price: "50000.00",
            quantity: 2,
            subtotal: "100000.00",
          },
        ],

        created_at: "2026-10-13T12:00:00.000Z",
        updated_at: "2026-10-13T13:00:00.000Z",
        paid_at: "2026-10-13T12:30:00.000Z",
      });
    });

    it("mempertahankan snapshot nama produk dan SKU dari order item", async () => {
      order.findFirst.mockResolvedValue(buildOrder());

      const result = await getOrderByIdService("user-42", "order-123");

      expect(result.items[0]).toEqual(
        expect.objectContaining({
          product_name: "Kaos Hitam",
          variant_sku: "KAOS-HITAM-L",
        }),
      );

      // Nama produk dan SKU berasal dari snapshot order item.
      // Service tidak membutuhkan JOIN ke Product untuk mapping ini.
      expect(order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            items: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        }),
      );
    });

    it("mempertahankan harga historis, bukan mengambil harga produk terkini", async () => {
      order.findFirst.mockResolvedValue(
        buildOrder({
          items: [
            {
              id: "order-item-1",
              productVariantId: "variant-1",
              productName: "Kaos Hitam",
              variantSku: "KAOS-HITAM-L",
              unitPrice: new Prisma.Decimal("95000.00"),
              quantity: 2,
              subtotal: new Prisma.Decimal("190000.00"),
              createdAt: new Date("2026-10-13T12:00:01.000Z"),
            },
          ],
          totalAmount: new Prisma.Decimal("190000.00"),
        }),
      );

      const result = await getOrderByIdService("user-42", "order-123");

      expect(result.total_amount).toBe("190000.00");
      expect(result.items[0].unit_price).toBe("95000.00");
      expect(result.items[0].subtotal).toBe("190000.00");
    });

    it("mengonversi tanggal ke ISO string dan mempertahankan paid_at null", async () => {
      order.findFirst.mockResolvedValue(
        buildOrder({
          status: "PENDING_PAYMENT",
          paymentStatus: "UNPAID",
          paidAt: null,
        }),
      );

      const result = await getOrderByIdService("user-42", "order-123");

      expect(result.created_at).toBe("2026-10-13T12:00:00.000Z");
      expect(result.updated_at).toBe("2026-10-13T13:00:00.000Z");

      expect(result.paid_at).toBeNull();
      expect(result).toHaveProperty("paid_at");
    });

    it("mempertahankan urutan item dari hasil query Prisma", async () => {
      const items = buildOrder().items;

      order.findFirst.mockResolvedValue(
        buildOrder({
          items: [items[1], items[0]],
        }),
      );

      const result = await getOrderByIdService("user-42", "order-123");

      // Service melakukan mapping, bukan menyortir ulang items.
      // Urutan sebenarnya dijamin oleh orderBy di query Prisma.
      expect(result.items.map((item) => item.id)).toEqual([
        "order-item-2",
        "order-item-1",
      ]);
    });
  });

  // ----------------------------------------------------------------
  // Not found
  // ----------------------------------------------------------------

  describe("order tidak ditemukan", () => {
    it("melempar 404 kalau order tidak ada atau milik user lain", async () => {
      order.findFirst.mockResolvedValue(null);

      await expect(
        getOrderByIdService("user-42", "order-missing"),
      ).rejects.toMatchObject({ statusCode: 404, code: "ORDER_NOT_FOUND" });
    });
  });

  // ----------------------------------------------------------------
  // Database error
  // ----------------------------------------------------------------

  describe("database error", () => {
    it("meneruskan error database tanpa mengubahnya secara diam-diam", async () => {
      const databaseError = new Error("Database unavailable");

      order.findFirst.mockRejectedValue(databaseError);

      await expect(getOrderByIdService("user-42", "order-123")).rejects.toBe(
        databaseError,
      );
    });
  });
});
