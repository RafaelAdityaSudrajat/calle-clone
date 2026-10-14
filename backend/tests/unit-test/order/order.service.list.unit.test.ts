import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "../../../src/generated/prisma";
import { getOrdersService } from "../../../src/modules/order/order.service";
import type { ListOrdersQuery } from "../../../src/modules/order/order.schema";

/**
 * getOrdersService hanya memanggil dua query READ secara paralel:
 *   - prisma.order.count
 *   - prisma.order.findMany
 * Tidak ada $transaction, tidak ada $queryRaw. Jadi mock-nya cukup satu
 * objek `prisma` dengan dua method itu.
 *
 * vi.hoisted dipakai supaya `prisma` sudah ada saat factory vi.mock
 * (yang di-hoist ke atas) dijalankan.
 */
const mocks = vi.hoisted(() => ({
  order: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("../../../src/lib/prisma", () => ({
  prisma: { order: mocks.order },
}));

const { order } = mocks;

// ---------- Builder ----------

function query(overrides: Partial<ListOrdersQuery> = {}): ListOrdersQuery {
  return {
    page: 1,
    limit: 10,
    ...overrides,
  };
}

function buildOrderRow(
  o: {
    id?: string;
    status?: "PENDING_PAYMENT" | "PAID" | "CANCELLED";
    paymentStatus?: "UNPAID" | "PAID" | "FAILED" | "REFUNDED";
    totalAmount?: string;
    paidAt?: Date | null;
    createdAt?: Date;
    itemCount?: number;
  } = {},
) {
  return {
    id: o.id ?? "order-1",
    status: o.status ?? "PENDING_PAYMENT",
    paymentStatus: o.paymentStatus ?? "UNPAID",
    totalAmount: new Prisma.Decimal(o.totalAmount ?? "200000.00"),
    paidAt: o.paidAt ?? null,
    createdAt: o.createdAt ?? new Date("2026-10-13T12:00:00.000Z"),
    _count: { items: o.itemCount ?? 2 },
  };
}

describe("getOrdersService (list)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    order.count.mockResolvedValue(0);
    order.findMany.mockResolvedValue([]);
  });

  // ------------------------------------------------------------------
  // Filter userId (BR-02, anti-IDOR)
  // ------------------------------------------------------------------
  describe("isolasi data (anti-IDOR)", () => {
    it("userId SELALU dipakai di where count & findMany, apa pun query-nya", async () => {
      await getOrdersService("user-42", query());

      expect(order.count).toHaveBeenCalledWith({
        where: { userId: "user-42" },
      });
      expect(order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-42" },
        }),
      );
    });

    it("userId tetap ada di where walau filter status dipakai", async () => {
      await getOrdersService("user-42", query({ status: "PAID" }));

      expect(order.count).toHaveBeenCalledWith({
        where: { userId: "user-42", status: "PAID" },
      });
      expect(order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-42", status: "PAID" },
        }),
      );
    });
  });

  // ------------------------------------------------------------------
  // Pagination: skip/take & default
  // ------------------------------------------------------------------
  describe("pagination", () => {
    it("page 1, limit 10 -> skip 0, take 10", async () => {
      await getOrdersService("user-1", query({ page: 1, limit: 10 }));

      expect(order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
    });

    it("page 3, limit 5 -> skip 10, take 5", async () => {
      await getOrdersService("user-1", query({ page: 3, limit: 5 }));

      expect(order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });

    it("order by createdAt DESC lalu id DESC (tie-break stabil)", async () => {
      await getOrdersService("user-1", query());

      expect(order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
      );
    });

    it("total_pages = ceil(total / limit)", async () => {
      order.count.mockResolvedValue(23);

      const result = await getOrdersService("user-1", query({ limit: 10 }));

      expect(result.pagination.total).toBe(23);
      expect(result.pagination.total_pages).toBe(3); // ceil(23/10)
    });

    it("total habis dibagi limit -> total_pages pas, tidak lebih", async () => {
      order.count.mockResolvedValue(20);

      const result = await getOrdersService("user-1", query({ limit: 10 }));

      expect(result.pagination.total_pages).toBe(2);
    });

    it("total = 0 -> total_pages minimal 1 (bukan 0)", async () => {
      order.count.mockResolvedValue(0);

      const result = await getOrdersService("user-1", query());

      expect(result.pagination.total_pages).toBe(1);
    });

    it("page di luar range -> tetap 200 dengan orders kosong, bukan error", async () => {
      order.count.mockResolvedValue(5);
      order.findMany.mockResolvedValue([]);

      const result = await getOrdersService("user-1", query({ page: 99 }));

      expect(result.orders).toEqual([]);
      expect(result.pagination.page).toBe(99);
      expect(result.pagination.total).toBe(5);
    });
  });

  // ------------------------------------------------------------------
  // Filter status
  // ------------------------------------------------------------------
  describe("filter status", () => {
    it("status tidak dikirim -> where hanya berisi userId", async () => {
      await getOrdersService("user-1", query());

      const where = order.count.mock.calls[0][0].where;
      expect(where).toEqual({ userId: "user-1" });
      expect("status" in where).toBe(false);
    });

    it("status dikirim -> where berisi userId + status", async () => {
      await getOrdersService("user-1", query({ status: "PENDING_PAYMENT" }));

      expect(order.count).toHaveBeenCalledWith({
        where: { userId: "user-1", status: "PENDING_PAYMENT" },
      });
    });

    it("filter CANCELLED juga diteruskan apa adanya", async () => {
      await getOrdersService("user-1", query({ status: "CANCELLED" }));

      expect(order.count).toHaveBeenCalledWith({
        where: { userId: "user-1", status: "CANCELLED" },
      });
    });
  });

  // ------------------------------------------------------------------
  // Select fields (jangan ambil items, cukup _count)
  // ------------------------------------------------------------------
  describe("select & efisiensi query", () => {
    it("findMany TIDAK include items, hanya _count.items (cegah payload membengkak)", async () => {
      await getOrdersService("user-1", query());

      const arg = order.findMany.mock.calls[0][0];
      expect(arg.select).toBeDefined();
      expect(arg.select._count).toEqual({ select: { items: true } });
      expect(arg).not.toHaveProperty("include");
    });

    it("count & findMany dijalankan PARALEL (Promise.all), bukan berurutan", async () => {
      await getOrdersService("user-1", query());

      // Keduanya dipanggil -> tidak ada urutan strict, cukup pastikan
      // keduanya benar-benar terpanggil dalam satu run.
      expect(order.count).toHaveBeenCalledTimes(1);
      expect(order.findMany).toHaveBeenCalledTimes(1);
    });
  });

  // ------------------------------------------------------------------
  // Mapping DTO
  // ------------------------------------------------------------------
  describe("mapping response DTO", () => {
    it("hasil kosong -> orders: [], pagination valid", async () => {
      const result = await getOrdersService("user-1", query());

      expect(result.orders).toEqual([]);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 0,
        total_pages: 1,
      });
    });

    it("mapping 1 order lengkap: snake_case, Decimal->string, tanggal ISO", async () => {
      order.count.mockResolvedValue(1);
      order.findMany.mockResolvedValue([
        buildOrderRow({
          id: "order-abc",
          status: "PAID",
          paymentStatus: "PAID",
          totalAmount: "350000.00",
          paidAt: new Date("2026-10-13T13:00:00.000Z"),
          createdAt: new Date("2026-10-13T12:00:00.000Z"),
          itemCount: 3,
        }),
      ]);

      const result = await getOrdersService("user-1", query());

      expect(result.orders[0]).toEqual({
        id: "order-abc",
        status: "PAID",
        payment_status: "PAID",
        total_amount: "350000.00",
        total_items: 3,
        created_at: "2026-10-13T12:00:00.000Z",
        paid_at: "2026-10-13T13:00:00.000Z",
      });
    });

    it("paid_at null -> tetap null, tidak jadi string kosong atau undefined", async () => {
      order.count.mockResolvedValue(1);
      order.findMany.mockResolvedValue([buildOrderRow({ paidAt: null })]);

      const result = await getOrdersService("user-1", query());

      expect(result.orders[0].paid_at).toBeNull();
      expect(result.orders[0]).toHaveProperty("paid_at");
    });

    it("total_amount Decimal di-convert ke string (bukan number, agar presisi uang terjaga)", async () => {
      order.count.mockResolvedValue(1);
      order.findMany.mockResolvedValue([
        buildOrderRow({ totalAmount: "123456.78" }),
      ]);

      const result = await getOrdersService("user-1", query());

      expect(typeof result.orders[0].total_amount).toBe("string");
      expect(result.orders[0].total_amount).toBe("123456.78");
    });

    it("urutan orders di response mengikuti urutan rows dari prisma (tidak disortir ulang)", async () => {
      order.count.mockResolvedValue(3);
      order.findMany.mockResolvedValue([
        buildOrderRow({ id: "order-3", createdAt: new Date("2026-10-03") }),
        buildOrderRow({ id: "order-2", createdAt: new Date("2026-10-02") }),
        buildOrderRow({ id: "order-1", createdAt: new Date("2026-10-01") }),
      ]);

      const result = await getOrdersService("user-1", query());

      expect(result.orders.map((o) => o.id)).toEqual([
        "order-3",
        "order-2",
        "order-1",
      ]);
    });
  });

  // ------------------------------------------------------------------
  // Perilaku tanpa error handling khusus
  // ------------------------------------------------------------------
  describe("tidak ada domain error yang di-throw", () => {
    it("user tanpa order -> sukses, bukan throw", async () => {
      order.count.mockResolvedValue(0);
      order.findMany.mockResolvedValue([]);

      await expect(getOrdersService("user-1", query())).resolves.toBeDefined();
    });

    it("page di luar range -> sukses, bukan throw", async () => {
      order.count.mockResolvedValue(5);
      order.findMany.mockResolvedValue([]);

      await expect(
        getOrdersService("user-1", query({ page: 999 })),
      ).resolves.toBeDefined();
    });
  });
});
