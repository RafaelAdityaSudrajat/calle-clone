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
});
