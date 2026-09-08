import bcrypt from "bcrypt";
import crypto from "crypto";
import request from "supertest";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { AccountStatus, AuditEvent, Role } from "../../../src/generated/prisma";

import app from "../../../src/app";
import { prisma } from "../../../src/lib/prisma";

import { cleanAuthDatabase } from "../helpers/database";

const TEST_PASSWORD = "Password123";

interface CreateTestUserInput {
  email?: string;
  password?: string;
  status?: AccountStatus;
  role?: Role;
}

const createTestUser = async ({
  email = `integration-${crypto.randomUUID()}@example.com`,
  password = TEST_PASSWORD,
  status = AccountStatus.ACTIVE,
  role = Role.BUYER,
}: CreateTestUserInput = {}) => {
  const passwordHash = await bcrypt.hash(password, 4);

  return prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      status,
      role,
    },
    select: {
      id: true,
      email: true,
    },
  });
};

/**
 * Helper login yang sudah disempurnakan.
 * Normalisasi array untuk mencegah error .find() saat extract cookie.
 */
const loginTestUser = async (email: string, password = TEST_PASSWORD) => {
  const response = await request(app).post("/api/auth/login").send({
    email,
    password,
  });

  const setCookieHeader = response.headers["set-cookie"];

  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];

  const accessTokenCookieRaw = cookies.find((c: string) =>
    c.startsWith("accessToken="),
  );
  const refreshTokenCookieRaw = cookies.find((c: string) =>
    c.startsWith("refreshToken="),
  );

  // Ambil value-nya saja untuk keperluan database/query
  const getCookieValue = (rawCookie?: string) => {
    return rawCookie ? rawCookie.split(";")[0].split("=")[1] : "";
  };

  return {
    accessTokenCookie: accessTokenCookieRaw
      ? accessTokenCookieRaw.split(";")[0]
      : "",
    refreshTokenCookie: refreshTokenCookieRaw
      ? refreshTokenCookieRaw.split(";")[0]
      : "",
    refreshTokenValue: getCookieValue(refreshTokenCookieRaw),
  };
};

/**
 * Helper untuk membuat dummy session aktif di device lain.
 */
const seedActiveSession = async (userId: string) => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  return prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashedToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
};

describe("Auth Integration — Logout & Logout All", () => {
  beforeEach(async () => {
    await cleanAuthDatabase();
  });

  afterAll(async () => {
    await cleanAuthDatabase();
    await prisma.$disconnect();
  });

  /**
   * =====================================
   * LOGOUT (SINGLE DEVICE)
   * =====================================
   */
  it("successfully logs out user from current device and clears cookies", async () => {
    /*
     * ARRANGE
     */
    const user = await createTestUser();
    const { refreshTokenCookie, refreshTokenValue } = await loginTestUser(
      user.email,
    );

    // Seed session di device lain (harus tetap hidup setelah logout ini)
    await seedActiveSession(user.id);

    // Pastikan sebelum logout ada 2 sesi aktif
    let activeSessionsCount = await prisma.refreshToken.count({
      where: { userId: user.id, revokedAt: null },
    });
    expect(activeSessionsCount).toBe(2);

    /*
     * ACT
     */
    const response = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", [refreshTokenCookie]);

    /*
     * ASSERT HTTP
     */
    expect(response.status).toBe(200);

    // Pastikan server mengirim instruksi untuk menghapus cookie di browser
    // Express clearCookie biasanya mengosongkan value dan set tanggal Expires ke masa lalu (1970)
    const setCookieHeader = response.headers["set-cookie"] || [];

    const setCookie = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : setCookieHeader
        ? [setCookieHeader]
        : [];

    const isAccessTokenCleared = setCookie.some(
      (c: string) =>
        c.match(/accessToken=;/i) || c.match(/Expires=Thu, 01 Jan 1970/i),
    );
    const isRefreshTokenCleared = setCookie.some(
      (c: string) =>
        c.match(/refreshToken=;/i) || c.match(/Expires=Thu, 01 Jan 1970/i),
    );

    expect(isAccessTokenCleared).toBe(true);
    expect(isRefreshTokenCleared).toBe(true);

    /*
     * ASSERT DATABASE (SESSION INVALIDATION)
     */
    // Sesi untuk device ini harus sudah di-revoke atau dihapus
    const hashedToken = crypto
      .createHash("sha256")
      .update(refreshTokenValue)
      .digest("hex");
    const loggedOutSession = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashedToken },
    });

    // Cek apakah data dihapus secara hard-delete, atau sekadar di-set revokedAt
    // (Sesuaikan dengan implementasimu, ini asumsi soft-delete / update revokedAt)
    expect(loggedOutSession?.revokedAt).not.toBeNull();

    // Sesi device lain harus tetap utuh
    activeSessionsCount = await prisma.refreshToken.count({
      where: { userId: user.id, revokedAt: null },
    });
    expect(activeSessionsCount).toBe(1);
  });

  /**
   * =====================================
   * LOGOUT ALL DEVICES
   * =====================================
   */
  it("successfully logs out user from all devices (logout-all)", async () => {
    /*
     * ARRANGE
     */
    const user = await createTestUser();
    const { accessTokenCookie } = await loginTestUser(user.email);

    // Seed 2 session aktif tambahan
    await seedActiveSession(user.id);
    await seedActiveSession(user.id);

    // Total sesi aktif sebelum logout-all harus 3
    let activeSessionsCount = await prisma.refreshToken.count({
      where: { userId: user.id, revokedAt: null },
    });
    expect(activeSessionsCount).toBe(3);

    /*
     * ACT
     * Perhatikan: logout-all butuh authenticate middleware, jadi pakai accessToken
     */
    const response = await request(app)
      .post("/api/auth/logout-all")
      .set("Cookie", [accessTokenCookie]);

    /*
     * ASSERT HTTP
     */
    expect(response.status).toBe(200);

    /*
     * ASSERT DATABASE (SESSION INVALIDATION)
     * Semua sesi aktif milik user ini harus di-revoke
     */
    activeSessionsCount = await prisma.refreshToken.count({
      where: { userId: user.id, revokedAt: null },
    });
    expect(activeSessionsCount).toBe(0); // Bersih semua

    /*
     * ASSERT AUDIT LOG
     */
    const auditLog = await prisma.auditLog.findFirst({
      where: { event: AuditEvent.LOGOUT_ALL, actorUserId: user.id },
    });
    expect(auditLog).not.toBeNull();
  });

  /**
   * =====================================
   * LOGOUT WITHOUT TOKEN (EDGE CASE)
   * =====================================
   */
  it("handles logout gracefully if no token is provided", async () => {
    // Tidak melampirkan cookie sama sekali
    const response = await request(app).post("/api/auth/logout");

    // Sesuai implementasi, bisa return 200 (karena toh tujuannya supaya tidak login)
    // Atau 400/401 jika memang diwajibkan validasi. Silakan sesuaikan statusnya!
    expect(response.status).toBe(200);
  });
});
