import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";

import app from "../../../src/app";
import { prisma } from "../../../src/lib/prisma";
import { getAccesTokenCookie } from "../helpers/auth";
import { cleanCartDatabase } from "../helpers/database";

/**
 * Mengaktifkan rate limiter Cart hanya selama test terkait.
 * Limiter autentikasi tetap menggunakan konfigurasi test normal.
 */
async function withCartRateLimitEnabled<T>(
  callback: () => Promise<T>,
): Promise<T> {
  const previous = process.env.TEST_CART_RATE_LIMIT;
  process.env.TEST_CART_RATE_LIMIT = "true";

  try {
    return await callback();
  } finally {
    if (previous === undefined) {
      delete process.env.TEST_CART_RATE_LIMIT;
    } else {
      process.env.TEST_CART_RATE_LIMIT = previous;
    }
  }
}

// Satu hal yang perlu dicatat: test ini membuktikan isolasi kuota dalam instance limiter yang sedang berjalan, menggunakan store default express-rate-limit. Kalau aplikasi nantinya dijalankan di beberapa server instance, kita perlu mengevaluasi shared store agar pembatasan tetap konsisten lintas instance.

describe("Cart rate limiting (integration)", () => {
  beforeEach(async () => {
    await cleanCartDatabase();
  });

  afterAll(async () => {
    await cleanCartDatabase();
    await prisma.$disconnect();
  });

  // ------------------------------------------------------------------
  // Add to Cart: 30 request per menit
  // ------------------------------------------------------------------

  describe("POST /api/v1/cart", () => {
    it("mengizinkan 30 request dalam window dan menolak request ke-31", async () => {
      await withCartRateLimitEnabled(async () => {
        const { accessTokenCookie } = await getAccesTokenCookie();

        // Body sengaja invalid agar test hanya menguji limiter dan
        // validasi, tanpa harus membuat product atau CartItem.
        for (let i = 0; i < 30; i++) {
          const res = await request(app)
            .post("/api/v1/cart")
            .set("Cookie", [accessTokenCookie])
            .send({});

          expect(res.status).toBe(400);
        }

        const blocked = await request(app)
          .post("/api/v1/cart")
          .set("Cookie", [accessTokenCookie])
          .send({});

        expect(blocked.status).toBe(429);
        expect(blocked.body).toMatchObject({
          status: "error",
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests. Please try again later.",
        });
      });
    });
  });

  // ------------------------------------------------------------------
  // Checkout: 5 request per menit
  // ------------------------------------------------------------------

  describe("POST /api/v1/cart/checkout", () => {
    it("mengizinkan 5 request dalam window dan menolak request ke-6", async () => {
      await withCartRateLimitEnabled(async () => {
        const { accessTokenCookie } = await getAccesTokenCookie();

        // Limiter dipasang sebelum validation middleware.
        // Karena itu request dengan body invalid tetap dihitung.
        for (let i = 0; i < 5; i++) {
          const res = await request(app)
            .post("/api/v1/cart/checkout")
            .set("Cookie", [accessTokenCookie])
            .set("Idempotency-Key", randomUUID())
            .send({});

          expect(res.status).toBe(400);
        }

        const blocked = await request(app)
          .post("/api/v1/cart/checkout")
          .set("Cookie", [accessTokenCookie])
          .set("Idempotency-Key", randomUUID())
          .send({});

        expect(blocked.status).toBe(429);
        expect(blocked.body).toMatchObject({
          status: "error",
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests. Please try again later.",
        });
      });
    });
  });

  describe("isolasi antar-user", () => {
    it("limit Add to Cart milik User A tidak memblokir User B", async () => {
      await withCartRateLimitEnabled(async () => {
        const userA = await getAccesTokenCookie();
        const userB = await getAccesTokenCookie();

        // User A menggunakan seluruh kuota Add to Cart: 30 request.
        // Payload sengaja invalid agar test berfokus pada rate limiter.
        for (let i = 0; i < 30; i++) {
          const res = await request(app)
            .post("/api/v1/cart")
            .set("Cookie", [userA.accessTokenCookie])
            .send({});

          expect(res.status).toBe(400);
        }

        // User B memiliki kuota sendiri, sehingga request-nya belum
        // boleh ditolak oleh rate limiter.
        const userBResponse = await request(app)
          .post("/api/v1/cart")
          .set("Cookie", [userB.accessTokenCookie])
          .send({});

        expect(userBResponse.status).toBe(400);
        expect(userBResponse.status).not.toBe(429);

        // Setelah kuota User A habis, request berikutnya harus ditolak.
        const userAResponse = await request(app)
          .post("/api/v1/cart")
          .set("Cookie", [userA.accessTokenCookie])
          .send({});

        expect(userAResponse.status).toBe(429);
        expect(userAResponse.body.code).toBe("RATE_LIMIT_EXCEEDED");
      });
    });

    it("limit Checkout milik User A tidak memblokir User B", async () => {
      await withCartRateLimitEnabled(async () => {
        const userA = await getAccesTokenCookie();
        const userB = await getAccesTokenCookie();

        // Lima request pertama User A menghabiskan kuota checkout.
        // Idempotency-Key valid, tetapi body checkout sengaja invalid.
        for (let i = 0; i < 5; i++) {
          const res = await request(app)
            .post("/api/v1/cart/checkout")
            .set("Cookie", [userA.accessTokenCookie])
            .set("Idempotency-Key", randomUUID())
            .send({});

          expect(res.status).toBe(400);
        }

        // User B masih memiliki jatah checkout sendiri.
        const userBResponse = await request(app)
          .post("/api/v1/cart/checkout")
          .set("Cookie", [userB.accessTokenCookie])
          .set("Idempotency-Key", randomUUID())
          .send({});

        expect(userBResponse.status).toBe(400);
        expect(userBResponse.status).not.toBe(429);

        // Request keenam User A harus terkena rate limit.
        const userAResponse = await request(app)
          .post("/api/v1/cart/checkout")
          .set("Cookie", [userA.accessTokenCookie])
          .set("Idempotency-Key", randomUUID())
          .send({});

        expect(userAResponse.status).toBe(429);
        expect(userAResponse.body.code).toBe("RATE_LIMIT_EXCEEDED");
      });
    });
  });
});
