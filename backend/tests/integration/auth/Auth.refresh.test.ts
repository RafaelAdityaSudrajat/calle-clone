import bcrypt from "bcrypt";
import crypto from "crypto";
import request from "supertest";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { AccountStatus, AuditEvent } from "../../../src/generated/prisma";

import app from "../../../src/app";
import { prisma } from "../../../src/lib/prisma";

import { cleanAuthDatabase } from "../helpers/database";

const TEST_PASSWORD = "Password123";

const GENERIC_SESSION_ERROR = "Sesi tidak valid. Silakan login kembali.";

interface CreateTestUserInput {
  email?: string;
  password?: string;
  status?: AccountStatus;
}

const createTestUser = async ({
  email = `integration-${crypto.randomUUID()}@example.com`,

  password = TEST_PASSWORD,

  status = AccountStatus.ACTIVE,
}: CreateTestUserInput = {}) => {
  const passwordHash = await bcrypt.hash(password, 4);

  return prisma.user.create({
    data: {
      email,
      passwordHash,
      status,
    },

    select: {
      id: true,
      email: true,
      status: true,
    },
  });
};

/**
 * Ambil raw value dari salah satu cookie
 * pada response Set-Cookie header.
 */
const extractCookieValue = (
  response: request.Response,
  name: string,
): string => {
  const setCookieHeader = response.headers["set-cookie"];

  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];

  const cookie = cookies.find((c) => c.startsWith(`${name}=`));

  if (!cookie) {
    throw new Error(`Cookie "${name}" tidak ditemukan pada response`);
  }

  return cookie.split(";")[0].split("=")[1];
};

/**
 * Login lewat endpoint asli supaya refresh token
 * yang didapat benar-benar valid (hash-nya cocok
 * dengan yang tersimpan di DB) tanpa perlu tahu
 * detail implementasi hashToken().
 */
const loginTestUser = async (email: string, password = TEST_PASSWORD) => {
  const response = await request(app).post("/api/auth/login").send({
    email,
    password,
  });

  return {
    response,
    refreshToken: extractCookieValue(response, "refreshToken"),
    accessToken: extractCookieValue(response, "accessToken"),
  };
};

const callRefresh = async (refreshToken?: string) => {
  const req = request(app).post("/api/auth/refresh");

  if (refreshToken) {
    req.set("Cookie", [`refreshToken=${refreshToken}`]);
  }

  return req;
};

describe("Auth Integration — Refresh Token Rotation", () => {
  beforeEach(async () => {
    await cleanAuthDatabase();
  });

  afterAll(async () => {
    await cleanAuthDatabase();

    await prisma.$disconnect();
  });

  /**
   * =====================================
   * ROTATED — HAPPY PATH
   * =====================================
   */
  it("rotates the refresh token and returns a new session", async () => {
    /*
     * ARRANGE
     */

    const user = await createTestUser();

    const { refreshToken: oldToken } = await loginTestUser(user.email);

    /*
     * ACT
     */

    const response = await callRefresh(oldToken);

    /*
     * ASSERT HTTP
     */

    expect(response.status).toBe(200);

    expect(response.body.data.user.email).toBe(user.email);

    const newToken = extractCookieValue(response, "refreshToken");

    expect(newToken).not.toBe(oldToken);

    /*
     * ASSERT DATABASE
     *
     * Token lama harus revoked DAN punya
     * replacedByToken (bukti rotasi, bukan
     * sekadar revoke biasa).
     */

    const allTokens = await prisma.refreshToken.findMany({
      where: { userId: user.id },

      orderBy: { createdAt: "asc" },
    });

    expect(allTokens).toHaveLength(2);

    expect(allTokens[0].revokedAt).not.toBeNull();
    expect(allTokens[0].replacedByToken).not.toBeNull();

    expect(allTokens[1].revokedAt).toBeNull();

    /*
     * Hanya boleh ada TEPAT SATU
     * sesi aktif setelah rotasi.
     */

    const activeCount = await prisma.refreshToken.count({
      where: { userId: user.id, revokedAt: null },
    });

    expect(activeCount).toBe(1);
  });

  /**
   * =====================================
   * MISSING TOKEN
   * =====================================
   */
  it("rejects refresh when no refresh token cookie is sent", async () => {
    const response = await callRefresh(undefined);

    expect(response.status).toBe(401);

    expect(response.body.message).toBe(GENERIC_SESSION_ERROR);
  });

  /**
   * =====================================
   * INVALID — UNKNOWN TOKEN
   * =====================================
   */
  it("rejects refresh with a token that doesn't exist", async () => {
    const fakeToken = crypto.randomBytes(32).toString("hex");

    const response = await callRefresh(fakeToken);

    expect(response.status).toBe(401);

    expect(response.body.message).toBe(GENERIC_SESSION_ERROR);
  });

  /**
   * =====================================
   * EXPIRED
   * =====================================
   */
  it("rejects and revokes an expired refresh token", async () => {
    /*
     * ARRANGE
     */

    const user = await createTestUser();

    const { refreshToken: token } = await loginTestUser(user.email);

    /*
     * Paksa token jadi expired langsung
     * lewat database, tanpa perlu tahu
     * hash-nya.
     */

    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },

      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    /*
     * ACT
     */

    const response = await callRefresh(token);

    /*
     * ASSERT
     */

    expect(response.status).toBe(401);

    expect(response.body.message).toBe(GENERIC_SESSION_ERROR);

    const tokenRow = await prisma.refreshToken.findFirst({
      where: { userId: user.id },
    });

    expect(tokenRow?.revokedAt).not.toBeNull();

    /*
     * Expired token TIDAK memicu
     * mass-revoke — beda dengan REUSED.
     */

    expect(tokenRow?.replacedByToken).toBeNull();
  });

  /**
   * =====================================
   * REVOKED — NO REPLACEMENT (e.g. after logout)
   * =====================================
   */
  it("rejects a revoked token that has no replacement", async () => {
    /*
     * ARRANGE
     */

    const user = await createTestUser();

    const { refreshToken: token } = await loginTestUser(user.email);

    await request(app)
      .post("/api/auth/logout")
      .set("Cookie", [`refreshToken=${token}`]);

    /*
     * ACT — coba pakai token yang sudah
     * di-logout tadi.
     */

    const response = await callRefresh(token);

    /*
     * ASSERT
     */

    expect(response.status).toBe(401);

    expect(response.body.message).toBe(GENERIC_SESSION_ERROR);
  });

  /**
   * =====================================
   * REUSED — TOKEN LAMA DIPAKAI SETELAH ROTASI
   * =====================================
   */
  it("detects reuse of an already-rotated token and kills all active sessions", async () => {
    /*
     * ARRANGE
     */

    const user = await createTestUser();

    const { refreshToken: firstToken } = await loginTestUser(user.email);

    /*
     * Rotasi pertama — sah, sesuai flow normal.
     */

    const rotateResponse = await callRefresh(firstToken);

    expect(rotateResponse.status).toBe(200);

    /*
     * ACT — reuse token LAMA yang sudah
     * digantikan (skenario token dicuri
     * lalu dipakai lagi).
     */

    const reuseResponse = await callRefresh(firstToken);

    /*
     * ASSERT HTTP
     */

    expect(reuseResponse.status).toBe(401);

    expect(reuseResponse.body.message).toBe(GENERIC_SESSION_ERROR);

    /*
     * ASSERT AUDIT
     */

    const reuseAudit = await prisma.auditLog.findFirst({
      where: {
        event: AuditEvent.REFRESH_TOKEN_REUSE_DETECTED,
        targetUserId: user.id,
      },
    });

    expect(reuseAudit).not.toBeNull();

    /*
     * ASSERT DATABASE
     *
     * SEMUA sesi—termasuk token hasil rotasi
     * yang sebenarnya masih sah—harus ikut
     * ter-revoke sebagai respons keamanan.
     */

    const activeCount = await prisma.refreshToken.count({
      where: { userId: user.id, revokedAt: null },
    });

    expect(activeCount).toBe(0);

    const totalCount = await prisma.refreshToken.count({
      where: { userId: user.id },
    });

    /*
     * Tidak ada token baru yang diterbitkan
     * untuk request yang REUSED.
     */

    expect(totalCount).toBe(2);
  });

  /**
   * =====================================
   * SUSPENDED
   * =====================================
   */
  it("rejects refresh for a suspended account and revokes all sessions", async () => {
    /*
     * ARRANGE
     */

    const user = await createTestUser();

    const { refreshToken: token } = await loginTestUser(user.email);

    await prisma.user.update({
      where: { id: user.id },
      data: { status: AccountStatus.SUSPENDED },
    });

    /*
     * ACT
     */

    const response = await callRefresh(token);

    /*
     * ASSERT
     */

    expect(response.status).toBe(409);

    expect(response.body.message).toBe("Akun tidak dapat digunakan");

    const activeCount = await prisma.refreshToken.count({
      where: { userId: user.id, revokedAt: null },
    });

    expect(activeCount).toBe(0);
  });

  /**
   * =====================================
   * REUSED — CONCURRENT REFRESH (bonus)
   * =====================================
   */
  it("allows only one of two concurrent refresh attempts to succeed", async () => {
    const user = await createTestUser();

    const { refreshToken: token } = await loginTestUser(user.email);

    const [responseA, responseB] = await Promise.all([
      callRefresh(token),
      callRefresh(token),
    ]);

    const statuses = [responseA.status, responseB.status].sort();

    expect(statuses).toEqual([200, 401]);

    /*
     * Setelah race, sesi yang tersisa
     * di database TIDAK BOLEH lebih dari 1
     * (kalau race gagal ditangani, bisa
     * ada 2 token aktif sekaligus).
     */

    const activeCount = await prisma.refreshToken.count({
      where: { userId: user.id, revokedAt: null },
    });

    expect(activeCount).toBeLessThanOrEqual(1);
  });
});
