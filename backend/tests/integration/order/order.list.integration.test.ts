import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import { getAccesTokenCookie } from "../helpers/auth";
import { cleanCartDatabase } from "../helpers/database";
import { seedProduct, seedVariant } from "../helpers/cart";
import { seedOrder } from "../helpers/order";
import { prisma } from "../../../src/lib/prisma";

/**
 * Siapkan user + N order. Return user, cookie, dan list order yang
 * di-seed (untuk assertion lanjutan). Order di-seed dengan createdAt
 * yang berbeda supaya urutan deterministic saat asserting sort.
 */
async function setupOrders(
  count: number,
  opts: {
    status?: "PENDING_PAYMENT" | "PAID" | "CANCELLED";
    startDate?: Date;
  } = {},
) {
  const { user, accessTokenCookie } = await getAccesTokenCookie();

  // Satu product + variant sebagai "pivot" untuk order items. Kalau
  // order item butuh productVariantId valid (FK), ini sumbernya.
  const product = await seedProduct({
    status: "ACTIVE",
    basePrice: "100000.00",
  });
  const variant = await seedVariant(product.id, { stock: 100 });

  const startDate = opts.startDate ?? new Date("2026-10-01T00:00:00.000Z");
  const orders = [];

  for (let i = 0; i < count; i++) {
    const createdAt = new Date(startDate.getTime() + i * 60_000); // +1 menit
    const order = await seedOrder(user.id, {
      status: opts.status ?? "PENDING_PAYMENT",
      paymentStatus: "UNPAID",
      totalAmount: "100000.00",
      createdAt,
      items: [
        {
          productVariantId: variant.id,
          productName: "Kaos Hitam",
          variantSku: "KAOS-HITAM-L",
          unitPrice: "100000.00",
          quantity: 1,
        },
      ],
    });
    orders.push(order);
  }

  return { user, accessTokenCookie, product, variant, orders };
}

describe("GET /api/v1/orders (integration)", () => {
  const endpoint = "/api/v1/orders";

  beforeEach(async () => {
    await cleanCartDatabase();
  });

  afterAll(async () => {
    await cleanCartDatabase();
    await prisma.$disconnect();
  });

  // ------------------------------------------------------------------
  // Otentikasi
  // ------------------------------------------------------------------
  describe("otentikasi", () => {
    it("balas 401 kalau tanpa cookie accessToken", async () => {
      const res = await request(app).get(endpoint);

      expect(res.status).toBe(401);
    });
  });

  // ------------------------------------------------------------------
  // Happy path
  // ------------------------------------------------------------------
  describe("happy path", () => {
    it("user tanpa order -> 200, orders kosong, pagination tetap valid", async () => {
      const { accessTokenCookie } = await getAccesTokenCookie();

      const res = await request(app)
        .get(endpoint)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Orders retrieved successfully");
      expect(res.body.data.orders).toEqual([]);
      expect(res.body.data.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 0,
        total_pages: 1, // minimal 1, bukan 0
      });
    });

    it("user punya order -> list tampil dengan DTO sesuai kontrak", async () => {
      const { accessTokenCookie, orders } = await setupOrders(1);

      const res = await request(app)
        .get(endpoint)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.orders).toHaveLength(1);

      const row = res.body.data.orders[0];
      expect(row).toEqual({
        id: orders[0].id,
        status: "PENDING_PAYMENT",
        payment_status: "UNPAID",
        total_amount: "100000.00",
        total_items: 1,
        created_at: orders[0].createdAt.toISOString(),
        paid_at: null,
      });
    });

    it("field tanggal dikirim sebagai ISO string (bukan objek Date)", async () => {
      const { accessTokenCookie } = await setupOrders(1);

      const res = await request(app)
        .get(endpoint)
        .set("Cookie", [accessTokenCookie]);

      const row = res.body.data.orders[0];
      expect(typeof row.created_at).toBe("string");
      // Regex ISO 8601 dengan milidetik & Z
      expect(row.created_at).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });

    it("total_amount dikirim sebagai string (bukan number, presisi uang terjaga)", async () => {
      const { accessTokenCookie } = await setupOrders(1);

      const res = await request(app)
        .get(endpoint)
        .set("Cookie", [accessTokenCookie]);

      expect(typeof res.body.data.orders[0].total_amount).toBe("string");
    });

    it("total_items = jumlah baris OrderItem (jenis produk, bukan jumlah qty)", async () => {
      const { user, accessTokenCookie, variant } = await setupOrders(0);
      await seedOrder(user.id, {
        items: [
          {
            productVariantId: variant.id,
            productName: "A",
            variantSku: "SKU-A",
            unitPrice: "100000.00",
            quantity: 5, // qty 5
          },
          {
            productVariantId: variant.id,
            productName: "B",
            variantSku: "SKU-B",
            unitPrice: "50000.00",
            quantity: 2, // qty 2
          },
        ],
      });

      const res = await request(app)
        .get(endpoint)
        .set("Cookie", [accessTokenCookie]);

      // 2 baris item, bukan 7 qty
      expect(res.body.data.orders[0].total_items).toBe(2);
    });
  });

  // ------------------------------------------------------------------
  // Urutan
  // ------------------------------------------------------------------
  describe("urutan", () => {
    it("order terbaru muncul DULU (createdAt DESC)", async () => {
      const { accessTokenCookie, orders } = await setupOrders(3);
      // orders[0] paling lama, orders[2] paling baru

      const res = await request(app)
        .get(endpoint)
        .set("Cookie", [accessTokenCookie]);

      const ids = res.body.data.orders.map((o: { id: string }) => o.id);
      expect(ids).toEqual([orders[2].id, orders[1].id, orders[0].id]);
    });
  });

  // ------------------------------------------------------------------
  // Pagination
  // ------------------------------------------------------------------
  describe("pagination", () => {
    it("default page=1, limit=10", async () => {
      const { accessTokenCookie } = await setupOrders(5);

      const res = await request(app)
        .get(endpoint)
        .set("Cookie", [accessTokenCookie]);

      expect(res.body.data.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 5,
        total_pages: 1,
      });
      expect(res.body.data.orders).toHaveLength(5);
    });

    it("limit=2 page=1 -> ambil 2 order TERBARU, total_pages=2 (kalau total 3)", async () => {
      const { accessTokenCookie, orders } = await setupOrders(3);

      const res = await request(app)
        .get(endpoint)
        .set("Cookie", [accessTokenCookie])
        .query({ page: "1", limit: "2" });

      expect(res.body.data.orders).toHaveLength(2);
      expect(res.body.data.orders.map((o: { id: string }) => o.id)).toEqual([
        orders[2].id,
        orders[1].id,
      ]);
      expect(res.body.data.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 3,
        total_pages: 2, // ceil(3/2)
      });
    });

    it("limit=2 page=2 -> ambil sisa order, tanpa duplikasi dari halaman 1", async () => {
      const { accessTokenCookie, orders } = await setupOrders(3);

      const page1 = await request(app)
        .get(endpoint)
        .set("Cookie", [accessTokenCookie])
        .query({ page: "1", limit: "2" });

      const page2 = await request(app)
        .get(endpoint)
        .set("Cookie", [accessTokenCookie])
        .query({ page: "2", limit: "2" });

      expect(page2.body.data.orders).toHaveLength(1);
      expect(page2.body.data.orders[0].id).toBe(orders[0].id);

      const ids1 = page1.body.data.orders.map((o: { id: string }) => o.id);
      const ids2 = page2.body.data.orders.map((o: { id: string }) => o.id);
      const intersection = ids1.filter((id: string) => ids2.includes(id));
      expect(intersection).toHaveLength(0);
    });

    it("page di luar range -> 200 dengan orders kosong, bukan error", async () => {
      const { accessTokenCookie } = await setupOrders(3);

      const res = await request(app)
        .get(endpoint)
        .set("Cookie", [accessTokenCookie])
        .query({ page: "99", limit: "10" });

      expect(res.status).toBe(200);
      expect(res.body.data.orders).toEqual([]);
      expect(res.body.data.pagination.page).toBe(99);
    });

    it("query string di-coerce: page & limit dari string '3' & '5' jadi number", async () => {
      const { accessTokenCookie } = await setupOrders(20);

      const res = await request(app)
        .get(endpoint)
        .set("Cookie", [accessTokenCookie])
        .query({ page: "3", limit: "5" });

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.page).toBe(3);
      expect(res.body.data.pagination.limit).toBe(5);
    });
  });

  // ------------------------------------------------------------------
  // Filter status
  // ------------------------------------------------------------------
  describe("filter status", () => {
    it("tanpa filter -> semua order tampil, terlepas dari status", async () => {
      const { user, accessTokenCookie, variant } = await setupOrders(0);
      await seedOrder(user.id, {
        status: "PENDING_PAYMENT",
        items: [{ productVariantId: variant.id }],
      });
      await seedOrder(user.id, {
        status: "PAID",
        paymentStatus: "PAID",
        paidAt: new Date(),
        items: [{ productVariantId: variant.id }],
      });
      await seedOrder(user.id, {
        status: "CANCELLED",
        items: [{ productVariantId: variant.id }],
      });

      const res = await request(app)
        .get(endpoint)
        .set("Cookie", [accessTokenCookie]);

      expect(res.body.data.orders).toHaveLength(3);
      expect(res.body.data.pagination.total).toBe(3);
    });

    it("?status=PAID -> hanya order PAID, pagination total ikut menyesuaikan", async () => {
      const { user, accessTokenCookie, variant } = await setupOrders(0);
      await seedOrder(user.id, {
        status: "PENDING_PAYMENT",
        items: [{ productVariantId: variant.id }],
      });
      await seedOrder(user.id, {
        status: "PAID",
        paymentStatus: "PAID",
        paidAt: new Date(),
        items: [{ productVariantId: variant.id }],
      });
      await seedOrder(user.id, {
        status: "PAID",
        paymentStatus: "PAID",
        paidAt: new Date(),
        items: [{ productVariantId: variant.id }],
      });

      const res = await request(app)
        .get(endpoint)
        .set("Cookie", [accessTokenCookie])
        .query({ status: "PAID" });

      expect(res.body.data.orders).toHaveLength(2);
      expect(res.body.data.pagination.total).toBe(2);
      for (const o of res.body.data.orders) {
        expect(o.status).toBe("PAID");
      }
    });

    it("?status=CANCELLED -> hanya order CANCELLED", async () => {
      const { user, accessTokenCookie, variant } = await setupOrders(0);
      await seedOrder(user.id, {
        status: "PENDING_PAYMENT",
        items: [{ productVariantId: variant.id }],
      });
      await seedOrder(user.id, {
        status: "CANCELLED",
        items: [{ productVariantId: variant.id }],
      });

      const res = await request(app)
        .get(endpoint)
        .set("Cookie", [accessTokenCookie])
        .query({ status: "CANCELLED" });

      expect(res.body.data.orders).toHaveLength(1);
      expect(res.body.data.orders[0].status).toBe("CANCELLED");
    });

    it("?status=<yang valid> tapi tidak ada order yang match -> 200, orders kosong", async () => {
      const { accessTokenCookie } = await setupOrders(3, {
        status: "PENDING_PAYMENT",
      });

      const res = await request(app)
        .get(endpoint)
        .set("Cookie", [accessTokenCookie])
        .query({ status: "CANCELLED" });

      expect(res.status).toBe(200);
      expect(res.body.data.orders).toEqual([]);
      expect(res.body.data.pagination.total).toBe(0);
    });
  });

  // ------------------------------------------------------------------
  // Validasi query
  // ------------------------------------------------------------------
  describe("validasi query", () => {
    it.each([
      ["page = 0", { page: "0" }],
      ["page negatif", { page: "-1" }],
      ["page desimal", { page: "1.5" }],
      ["page bukan angka", { page: "abc" }],
      ["limit = 0", { limit: "0" }],
      ["limit > 50", { limit: "51" }],
      ["limit desimal", { limit: "10.5" }],
      ["status tidak dikenal enum", { status: "SHIPPED" }],
      ["field asing (strictObject)", { utm_source: "x" }],
    ])("balas 400 untuk query: %s", async (_label, q) => {
      const { accessTokenCookie } = await getAccesTokenCookie();

      const res = await request(app)
        .get(endpoint)
        .set("Cookie", [accessTokenCookie])
        .query(q);

      expect(res.status).toBe(400);
    });

    it("limit=50 (boundary atas) -> diterima", async () => {
      const { accessTokenCookie } = await getAccesTokenCookie();

      const res = await request(app)
        .get(endpoint)
        .set("Cookie", [accessTokenCookie])
        .query({ limit: "50" });

      expect(res.status).toBe(200);
    });

    it("page=1 (boundary bawah) -> diterima", async () => {
      const { accessTokenCookie } = await getAccesTokenCookie();

      const res = await request(app)
        .get(endpoint)
        .set("Cookie", [accessTokenCookie])
        .query({ page: "1" });

      expect(res.status).toBe(200);
    });
  });

  // ------------------------------------------------------------------
  // Isolasi antar user (anti-IDOR)
  // ------------------------------------------------------------------
  describe("isolasi antar user (anti-IDOR)", () => {
    it("user A TIDAK melihat order milik user B di list", async () => {
      const userA = await setupOrders(2);
      const userB = await setupOrders(3);

      const res = await request(app)
        .get(endpoint)
        .set("Cookie", [userA.accessTokenCookie]);

      expect(res.body.data.orders).toHaveLength(2);
      expect(res.body.data.pagination.total).toBe(2);

      // Pastikan tidak ada order ID milik user B yang bocor
      const bIds = userB.orders.map((o) => o.id);
      const returnedIds = res.body.data.orders.map((o: { id: string }) => o.id);
      for (const id of returnedIds) {
        expect(bIds).not.toContain(id);
      }
    });

    it("user B tidak melihat order user A, terlepas dari filter status", async () => {
      const userA = await setupOrders(2, { status: "PAID" });
      const userB = await setupOrders(1, { status: "PENDING_PAYMENT" });

      const res = await request(app)
        .get(endpoint)
        .set("Cookie", [userB.accessTokenCookie])
        .query({ status: "PAID" });

      // User B TIDAK punya order PAID -> kosong, walaupun user A punya.
      // Ini yang membuktikan filter status tidak "membocorkan" order
      // user lain lewat where yang salah.
      expect(res.body.data.orders).toEqual([]);
      expect(res.body.data.pagination.total).toBe(0);
      expect(userA.orders.length).toBeGreaterThan(0); // sanity
    });

    it("total_pages dihitung dari order MILIK USER, bukan global", async () => {
      await setupOrders(20); // user A: 20 order
      const userB = await setupOrders(1); // user B: 1 order

      const res = await request(app)
        .get(endpoint)
        .set("Cookie", [userB.accessTokenCookie]);

      // Kalau total_pages dihitung dari semua order di DB, dia akan
      // jadi 3 (ceil(21/10)). Yang benar: 1, karena user B cuma punya 1.
      expect(res.body.data.pagination.total).toBe(1);
      expect(res.body.data.pagination.total_pages).toBe(1);
    });
  });
});
