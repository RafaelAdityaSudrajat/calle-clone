import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";

import app from "../../../src/app";
import { prisma } from "../../../src/lib/prisma";

import { getAccesTokenCookie } from "../helpers/auth";
import { cleanCartDatabase } from "../helpers/database";
import { seedProduct, seedVariant } from "../helpers/cart";
import { seedOrder } from "../helpers/order";

/**
 * Endpoint yang diuji:
 * GET /api/v1/orders/:orderId
 *
 * Ini integration test sungguhan:
 *   - HTTP melewati Express, authentication, validation, controller,
 *     service, dan Prisma.
 *   - Prisma menggunakan database integration test, bukan mock.
 *   - Fixture dibuat dengan helper seed yang sudah tersedia.
 *
 * Fokus utama:
 *   1. Autentikasi dan validasi UUID.
 *   2. User hanya dapat membaca order miliknya.
 *   3. Order yang tidak ada dan order milik user lain memberikan
 *      respons not-found yang setara.
 *   4. DTO berisi snapshot order, bukan data produk terkini.
 *   5. Field internal seperti userId dan idempotencyKey tidak bocor.
 */

const endpoint = "/api/v1/orders";

// ------------------------------------------------------------------
// Builder
// ------------------------------------------------------------------

type OrderStatus = "PENDING_PAYMENT" | "PAID" | "CANCELLED";

type PaymentStatus = "UNPAID" | "PAID" | "FAILED" | "REFUNDED";

type OrderItemInput = {
  productName?: string;
  variantSku?: string;
  unitPrice?: string;
  quantity?: number;
};

/**
 * Siapkan user, access token, product, variant, dan satu order.
 *
 * ProductVariant diperlukan karena OrderItem memiliki foreign key.
 * Order sendiri tetap menyimpan snapshot nama produk, SKU, dan harga.
 *
 * Setiap pemanggilan membuat user dan fixture baru agar test tidak
 * bergantung pada urutan eksekusi test sebelumnya.
 */
async function setupOrder(
  opts: {
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
    totalAmount?: string;
    paidAt?: Date | null;
    createdAt?: Date;
    idempotencyKey?: string;
    items?: OrderItemInput[];
  } = {},
) {
  const { user, accessTokenCookie } = await getAccesTokenCookie();

  const product = await seedProduct({
    status: "ACTIVE",
    basePrice: "100000.00",
  });

  const variant = await seedVariant(product.id, {
    stock: 100,
  });

  const itemInputs = opts.items ?? [
    {
      productName: "Kaos Hitam",
      variantSku: "KAOS-HITAM-L",
      unitPrice: "100000.00",
      quantity: 2,
    },
  ];

  const order = await seedOrder(user.id, {
    status: opts.status ?? "PENDING_PAYMENT",
    paymentStatus: opts.paymentStatus ?? "UNPAID",
    totalAmount: opts.totalAmount ?? "200000.00",

    ...(opts.paidAt !== undefined ? { paidAt: opts.paidAt } : {}),

    ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),

    ...(opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : {}),

    items: itemInputs.map((item) => ({
      productVariantId: variant.id,
      ...item,
    })),
  });

  return {
    user,
    accessTokenCookie,
    product,
    variant,
    order,
  };
}

// ------------------------------------------------------------------
// Lifecycle
// ------------------------------------------------------------------

describe("GET /api/v1/orders/:orderId (integration)", () => {
  beforeEach(async () => {
    await cleanCartDatabase();
  });

  afterAll(async () => {
    await cleanCartDatabase();
    await prisma.$disconnect();
  });

  // ----------------------------------------------------------------
  // Otentikasi
  // ----------------------------------------------------------------

  describe("otentikasi", () => {
    it("balas 401 ketika request tidak membawa cookie accessToken", async () => {
      const res = await request(app).get(`${endpoint}/${randomUUID()}`);

      expect(res.status).toBe(401);
    });
  });

  // ----------------------------------------------------------------
  // Validasi parameter
  // ----------------------------------------------------------------

  describe("validasi parameter", () => {
    it("balas 400 ketika orderId bukan UUID valid", async () => {
      const { accessTokenCookie } = await getAccesTokenCookie();

      const res = await request(app)
        .get(`${endpoint}/bukan-uuid`)
        .set("Cookie", [accessTokenCookie]);

      // orderParamsSchema menolak format ID sebelum service dipanggil.
      // ID dengan format invalid berbeda dari UUID valid yang tidak ada.
      expect(res.status).toBe(400);
    });

    it("menerima UUID valid untuk pencarian order", async () => {
      const { accessTokenCookie, order } = await setupOrder();

      const res = await request(app)
        .get(`${endpoint}/${order.id}`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
    });
  });

  // ----------------------------------------------------------------
  // Happy path
  // ----------------------------------------------------------------

  describe("happy path", () => {
    it("mengembalikan detail order milik user dengan DTO sesuai kontrak", async () => {
      const paidAt = new Date("2026-10-13T13:00:00.000Z");

      const { accessTokenCookie, variant, order } = await setupOrder({
        status: "PAID",
        paymentStatus: "PAID",
        totalAmount: "200000.00",
        paidAt,
        createdAt: new Date("2026-10-13T12:00:00.000Z"),
        idempotencyKey: `test-key-${randomUUID()}`,
        items: [
          {
            productName: "Kaos Hitam",
            variantSku: "KAOS-HITAM-L",
            unitPrice: "100000.00",
            quantity: 2,
          },
        ],
      });

      const res = await request(app)
        .get(`${endpoint}/${order.id}`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Order retrieved successfully");

      // Assertion DTO secara lengkap sekaligus memastikan tidak ada
      // field database yang tidak termasuk kontrak publik.
      expect(res.body.data).toEqual({
        id: order.id,
        status: "PAID",
        payment_status: "PAID",
        total_amount: "200000.00",

        shipping_address: {
          recipient_name: "Test Receiver",
          phone: "081234567890",
          address_line: "Jl. Test No. 1",
          city: "Bandung",
          postal_code: "40111",
        },

        items: [
          {
            id: order.items[0].id,
            product_variant_id: variant.id,
            product_name: "Kaos Hitam",
            variant_sku: "KAOS-HITAM-L",
            unit_price: "100000.00",
            quantity: 2,
            subtotal: "200000.00",
          },
        ],

        created_at: order.createdAt.toISOString(),
        updated_at: order.updatedAt.toISOString(),
        paid_at: paidAt.toISOString(),
      });
    });

    it("order belum dibayar -> paid_at null, bukan string kosong", async () => {
      const { accessTokenCookie, order } = await setupOrder({
        status: "PENDING_PAYMENT",
        paymentStatus: "UNPAID",
        paidAt: null,
      });

      const res = await request(app)
        .get(`${endpoint}/${order.id}`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("PENDING_PAYMENT");
      expect(res.body.data.payment_status).toBe("UNPAID");
      expect(res.body.data.paid_at).toBeNull();
      expect(res.body.data).toHaveProperty("paid_at");
    });

    it("tanggal dikirim sebagai ISO string, bukan representasi Date", async () => {
      const { accessTokenCookie, order } = await setupOrder({
        createdAt: new Date("2026-10-13T12:00:00.000Z"),
      });

      const res = await request(app)
        .get(`${endpoint}/${order.id}`)
        .set("Cookie", [accessTokenCookie]);

      const data = res.body.data;

      expect(typeof data.created_at).toBe("string");
      expect(typeof data.updated_at).toBe("string");

      expect(data.created_at).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );

      expect(data.updated_at).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );

      expect(data.created_at).toBe(order.createdAt.toISOString());
    });

    it("nilai uang dikirim sebagai string agar format uang konsisten", async () => {
      const { accessTokenCookie, order } = await setupOrder();

      const res = await request(app)
        .get(`${endpoint}/${order.id}`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);
      expect(typeof res.body.data.total_amount).toBe("string");
      expect(typeof res.body.data.items[0].unit_price).toBe("string");
      expect(typeof res.body.data.items[0].subtotal).toBe("string");

      expect(res.body.data.total_amount).toBe("200000.00");
    });
  });

  // ----------------------------------------------------------------
  // Snapshot order
  // ----------------------------------------------------------------

  describe("snapshot order", () => {
    it("mengembalikan nama produk dan SKU historis, meskipun data produk berubah", async () => {
      const { accessTokenCookie, product, variant, order } = await setupOrder({
        totalAmount: "190000.00",
        items: [
          {
            productName: "Nama Produk Saat Checkout",
            variantSku: "SKU-SAAT-CHECKOUT",
            unitPrice: "95000.00",
            quantity: 2,
          },
        ],
      });

      // Simulasikan perubahan katalog setelah order terbentuk.
      // Histori order tidak boleh mengikuti nama produk atau SKU terbaru.
      await prisma.product.update({
        where: { id: product.id },
        data: { name: "Nama Produk Terbaru" },
      });

      await prisma.productVariant.update({
        where: { id: variant.id },
        data: { sku: `SKU-TERKINI-${randomUUID()}` },
      });

      const res = await request(app)
        .get(`${endpoint}/${order.id}`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);

      const item = res.body.data.items[0];

      expect(item.product_name).toBe("Nama Produk Saat Checkout");
      expect(item.variant_sku).toBe("SKU-SAAT-CHECKOUT");
      expect(item.unit_price).toBe("95000.00");
      expect(item.subtotal).toBe("190000.00");
    });

    it("mengembalikan snapshot alamat dari order, bukan alamat user terkini", async () => {
      const { accessTokenCookie, order } = await setupOrder();

      const res = await request(app)
        .get(`${endpoint}/${order.id}`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);

      expect(res.body.data.shipping_address).toEqual({
        recipient_name: "Test Receiver",
        phone: "081234567890",
        address_line: "Jl. Test No. 1",
        city: "Bandung",
        postal_code: "40111",
      });
    });

    it("mengembalikan items berdasarkan createdAt ASC", async () => {
      const { accessTokenCookie, order } = await setupOrder({
        totalAmount: "150000.00",
        items: [
          {
            productName: "Item Dibuat Pertama",
            variantSku: "SKU-FIRST",
            unitPrice: "100000.00",
            quantity: 1,
          },
          {
            productName: "Item Dibuat Kedua",
            variantSku: "SKU-SECOND",
            unitPrice: "50000.00",
            quantity: 1,
          },
        ],
      });

      // Jangan mengandalkan timestamp default saat INSERT: dua item bisa
      // memiliki createdAt identik. Atur timestamp berbeda secara eksplisit
      // dan sengaja balikkan urutan waktunya.
      const firstInserted = order.items.find(
        (item) => item.productName === "Item Dibuat Pertama",
      );

      const secondInserted = order.items.find(
        (item) => item.productName === "Item Dibuat Kedua",
      );

      expect(firstInserted).toBeDefined();
      expect(secondInserted).toBeDefined();

      await Promise.all([
        prisma.orderItem.update({
          where: { id: firstInserted!.id },
          data: {
            createdAt: new Date("2026-10-13T12:00:02.000Z"),
          },
        }),
        prisma.orderItem.update({
          where: { id: secondInserted!.id },
          data: {
            createdAt: new Date("2026-10-13T12:00:01.000Z"),
          },
        }),
      ]);

      const res = await request(app)
        .get(`${endpoint}/${order.id}`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);

      // Item kedua secara input lebih baru, tetapi createdAt-nya lebih awal.
      // Query harus mengembalikan urutan berdasarkan timestamp database.
      expect(
        res.body.data.items.map((item: { id: string }) => item.id),
      ).toEqual([secondInserted!.id, firstInserted!.id]);
    });
  });

  // ----------------------------------------------------------------
  // Keamanan response
  // ----------------------------------------------------------------

  describe("field internal tidak bocor", () => {
    it("tidak membocorkan userId, idempotencyKey, atau field internal lainnya", async () => {
      const { accessTokenCookie, order } = await setupOrder({
        idempotencyKey: `secret-key-${randomUUID()}`,
      });

      const res = await request(app)
        .get(`${endpoint}/${order.id}`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(200);

      const data = res.body.data;

      expect(data).not.toHaveProperty("userId");
      expect(data).not.toHaveProperty("user_id");
      expect(data).not.toHaveProperty("idempotencyKey");
      expect(data).not.toHaveProperty("idempotency_key");

      // OrderItem juga hanya mengekspos field yang dibutuhkan frontend.
      for (const item of data.items) {
        expect(item).not.toHaveProperty("orderId");
        expect(item).not.toHaveProperty("order_id");
      }
    });
  });

  // ----------------------------------------------------------------
  // Not found
  // ----------------------------------------------------------------

  describe("order tidak ditemukan", () => {
    it("balas 404 ORDER_NOT_FOUND ketika UUID valid tidak memiliki order", async () => {
      const { accessTokenCookie } = await getAccesTokenCookie();
      const missingOrderId = randomUUID();

      const res = await request(app)
        .get(`${endpoint}/${missingOrderId}`)
        .set("Cookie", [accessTokenCookie]);

      expect(res.status).toBe(404);

      // Asumsi errorHandler mengekspos code pada body.code.
      // Jika kontrak errorHandler menaruhnya di lokasi lain, samakan
      // assertion ini dengan format error aktual proyek.
      expect(res.body).toMatchObject({
        status: "error",
        message: "Order not found",
        code: "ORDER_NOT_FOUND",
      });
    });
  });

  // ----------------------------------------------------------------
  // Isolasi antar user (anti-IDOR)
  // ----------------------------------------------------------------

  describe("isolasi antar user (anti-IDOR)", () => {
    it("user A tidak dapat membaca detail order milik user B", async () => {
      const owner = await setupOrder();
      const otherUser = await getAccesTokenCookie();

      const res = await request(app)
        .get(`${endpoint}/${owner.order.id}`)
        .set("Cookie", [otherUser.accessTokenCookie]);

      expect(res.status).toBe(404);

      expect(res.body).toMatchObject({
        status: "error",
        message: "Order not found",
        code: "ORDER_NOT_FOUND",
      });
    });

    it("order milik user lain dan UUID yang tidak ditemukan menghasilkan respons yang sama", async () => {
      const owner = await setupOrder();
      const otherUser = await getAccesTokenCookie();
      const missingOrderId = randomUUID();

      // Kedua request memakai user yang sama. Perbedaannya hanya apakah
      // ID menunjuk order user lain atau tidak menunjuk order sama sekali.
      const missingResponse = await request(app)
        .get(`${endpoint}/${missingOrderId}`)
        .set("Cookie", [otherUser.accessTokenCookie]);

      const foreignResponse = await request(app)
        .get(`${endpoint}/${owner.order.id}`)
        .set("Cookie", [otherUser.accessTokenCookie]);

      expect(missingResponse.status).toBe(404);
      expect(foreignResponse.status).toBe(404);

      // Memastikan tidak ada perbedaan pesan/kode/struktur response yang
      // dapat dipakai attacker untuk menebak keberadaan order orang lain.
      expect(foreignResponse.body).toEqual(missingResponse.body);
    });
  });
});
