import bcrypt from "bcrypt";
import crypto from "crypto";
import request from "supertest";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { AccountStatus, AuditEvent } from "../../../src/generated/prisma";

import app from "../../../src/app";
import { prisma } from "../../../src/lib/prisma";

import { cleanAuthDatabase } from "../helpers/database";

const TEST_PASSWORD = "Password123";

const MAX_FAILED_LOGIN_ATTEMPTS = 5;

const LOGIN_WINDOW_MS = 15 * 60 * 1000;

const ACCOUNT_LOCK_DURATION_MS = 15 * 60 * 1000;

interface CreateTestUserInput {
  email?: string;
  password?: string;
  status?: AccountStatus;

  failedLoginAttempts?: number;
  failedLoginWindowStart?: Date | null;
  lockoutUntil?: Date | null;
}

/**
 * Test fixture.
 *
 * Bisa dipakai untuk seed kondisi failed-login
 * langsung tanpa harus melakukan request gagal
 * berulang kali.
 */
const createTestUser = async ({
  email = `integration-${crypto.randomUUID()}@example.com`,

  password = TEST_PASSWORD,

  status = AccountStatus.ACTIVE,

  failedLoginAttempts = 0,
  failedLoginWindowStart = null,
  lockoutUntil = null,
}: CreateTestUserInput = {}) => {
  const passwordHash = await bcrypt.hash(password, 4);

  return prisma.user.create({
    data: {
      email,
      passwordHash,
      status,

      failedLoginAttempts,
      failedLoginWindowStart,
      lockoutUntil,
    },

    select: {
      id: true,
      email: true,
      status: true,
      failedLoginAttempts: true,
      failedLoginWindowStart: true,
      lockoutUntil: true,
    },
  });
};

describe("Auth Integration — Account Lockout", () => {
  beforeEach(async () => {
    await cleanAuthDatabase();
  });

  afterAll(async () => {
    await cleanAuthDatabase();

    await prisma.$disconnect();
  });

  /**
   * =====================================
   * LOCKOUT — TRIGGERED ON 5TH ATTEMPT
   * =====================================
   */
  it(`locks the account on the ${MAX_FAILED_LOGIN_ATTEMPTS}th consecutive failed attempt`, async () => {
    /*
     * ARRANGE
     */

    const user = await createTestUser();

    /*
     * ACT — 4 percobaan gagal pertama.
     *
     * Belum boleh memicu lockout.
     */

    for (let attempt = 1; attempt < MAX_FAILED_LOGIN_ATTEMPTS; attempt++) {
      const response = await request(app).post("/api/auth/login").send({
        email: user.email,
        password: "WrongPassword123",
      });

      expect(response.status).toBe(401);
    }

    const afterFourthAttempt = await prisma.user.findUnique({
      where: { id: user.id },

      select: {
        failedLoginAttempts: true,
        lockoutUntil: true,
      },
    });

    expect(afterFourthAttempt?.failedLoginAttempts).toBe(
      MAX_FAILED_LOGIN_ATTEMPTS - 1,
    );

    expect(afterFourthAttempt?.lockoutUntil).toBeNull();

    /*
     * ACT — percobaan gagal ke-5.
     *
     * Ini yang memicu lockout DI REQUEST YANG SAMA,
     * jadi response-nya harus 409, BUKAN 401.
     */

    const lockingResponse = await request(app).post("/api/auth/login").send({
      email: user.email,
      password: "WrongPassword123",
    });

    /*
     * ASSERT HTTP
     */

    expect(lockingResponse.status).toBe(409);

    expect(lockingResponse.body.message).toBe(
      "Terlalu banyak percobaan login. Silakan coba lagi nanti.",
    );

    /*
     * ASSERT DATABASE
     *
     * Counter di-reset karena akun sudah
     * pindah ke state LOCKED.
     */

    const lockedUser = await prisma.user.findUnique({
      where: { id: user.id },

      select: {
        failedLoginAttempts: true,
        failedLoginWindowStart: true,
        lockoutUntil: true,
      },
    });

    expect(lockedUser?.failedLoginAttempts).toBe(0);
    expect(lockedUser?.failedLoginWindowStart).toBeNull();
    expect(lockedUser?.lockoutUntil).not.toBeNull();

    const lockoutDurationMs = lockedUser!.lockoutUntil!.getTime() - Date.now();

    /*
     * Toleransi beberapa detik untuk
     * waktu eksekusi test.
     */
    expect(lockoutDurationMs).toBeGreaterThan(ACCOUNT_LOCK_DURATION_MS - 5000);

    expect(lockoutDurationMs).toBeLessThanOrEqual(ACCOUNT_LOCK_DURATION_MS);

    /*
     * ASSERT AUDIT
     *
     * Percobaan ke-5 seharusnya mencatat
     * KEDUA event: LOGIN_FAILED dan ACCOUNT_LOCKED.
     */

    const failedAttemptsAudit = await prisma.auditLog.count({
      where: {
        event: AuditEvent.LOGIN_FAILED,
        targetUserId: user.id,
      },
    });

    expect(failedAttemptsAudit).toBe(MAX_FAILED_LOGIN_ATTEMPTS);

    const lockedAudit = await prisma.auditLog.findFirst({
      where: {
        event: AuditEvent.ACCOUNT_LOCKED,
        targetUserId: user.id,
      },
    });

    expect(lockedAudit).not.toBeNull();

    /*
     * Tidak boleh ada session yang terbuat
     * sepanjang proses ini.
     */

    const sessionCount = await prisma.refreshToken.count({
      where: { userId: user.id },
    });

    expect(sessionCount).toBe(0);
  });

  /**
   * =====================================
   * LOCKOUT — REJECTS EVEN WITH CORRECT PASSWORD
   * =====================================
   */
  it("rejects login while locked, even with the correct password", async () => {
    /*
     * ARRANGE
     *
     * Lockout masih 10 menit lagi.
     */

    const user = await createTestUser({
      lockoutUntil: new Date(Date.now() + 10 * 60 * 1000),
    });

    /*
     * ACT
     */

    const response = await request(app).post("/api/auth/login").send({
      email: user.email,
      password: TEST_PASSWORD,
    });

    /*
     * ASSERT
     *
     * Ditolak sebelum password sempat
     * dicek sama sekali.
     */

    expect(response.status).toBe(409);

    expect(response.body.message).toBe(
      "Terlalu banyak percobaan login. Silakan coba lagi nanti.",
    );

    const sessionCount = await prisma.refreshToken.count({
      where: { userId: user.id },
    });

    expect(sessionCount).toBe(0);

    /*
     * Karena flow keluar sebelum password check,
     * LOGIN_SUCCESS maupun LOGIN_FAILED
     * tidak boleh tercatat untuk request ini.
     */

    const loginSuccessAudit = await prisma.auditLog.findFirst({
      where: {
        event: AuditEvent.LOGIN_SUCCESS,
        targetUserId: user.id,
      },
    });

    expect(loginSuccessAudit).toBeNull();
  });

  /**
   * =====================================
   * LOCKOUT — EXPIRES AFTER DURATION
   * =====================================
   */
  it("allows login again once the lockout duration has passed", async () => {
    /*
     * ARRANGE
     *
     * Lockout sudah lewat 1 menit yang lalu.
     */

    const user = await createTestUser({
      lockoutUntil: new Date(Date.now() - 60 * 1000),
    });

    /*
     * ACT
     */

    const response = await request(app).post("/api/auth/login").send({
      email: user.email,
      password: TEST_PASSWORD,
    });

    /*
     * ASSERT
     */

    expect(response.status).toBe(200);

    const sessionCount = await prisma.refreshToken.count({
      where: { userId: user.id, revokedAt: null },
    });

    expect(sessionCount).toBe(1);
  });

  /**
   * =====================================
   * WINDOW — EXPIRED WINDOW RESETS COUNTER
   * =====================================
   */
  it("treats a failed attempt as attempt #1 once the tracking window has expired", async () => {
    /*
     * ARRANGE
     *
     * 4 failed attempts, tapi window-nya
     * sudah lewat 16 menit (> 15 menit).
     */

    const user = await createTestUser({
      failedLoginAttempts: 4,
      failedLoginWindowStart: new Date(Date.now() - 16 * 60 * 1000),
    });

    /*
     * ACT
     */

    const response = await request(app).post("/api/auth/login").send({
      email: user.email,
      password: "WrongPassword123",
    });

    /*
     * ASSERT HTTP
     *
     * Bukan 409 — window lama sudah expired,
     * jadi ini dihitung ulang sebagai attempt #1.
     */

    expect(response.status).toBe(401);

    /*
     * ASSERT DATABASE
     */

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },

      select: {
        failedLoginAttempts: true,
        failedLoginWindowStart: true,
        lockoutUntil: true,
      },
    });

    expect(updatedUser?.failedLoginAttempts).toBe(1);
    expect(updatedUser?.lockoutUntil).toBeNull();

    /*
     * Window baru harus dimulai dari sekarang,
     * bukan meneruskan window lama.
     */

    const windowAgeMs =
      Date.now() - updatedUser!.failedLoginWindowStart!.getTime();

    expect(windowAgeMs).toBeLessThan(5000);
  });

  /**
   * =====================================
   * SUCCESS — RESETS FAILED-LOGIN STATE
   * =====================================
   */
  it("resets failed-login counters after a successful login", async () => {
    /*
     * ARRANGE
     *
     * User punya 3 failed attempts aktif,
     * tapi passwordnya benar.
     */

    const user = await createTestUser({
      failedLoginAttempts: 3,
      failedLoginWindowStart: new Date(),
    });

    /*
     * ACT
     */

    const response = await request(app).post("/api/auth/login").send({
      email: user.email,
      password: TEST_PASSWORD,
    });

    /*
     * ASSERT HTTP
     */

    expect(response.status).toBe(200);

    /*
     * ASSERT DATABASE
     */

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },

      select: {
        failedLoginAttempts: true,
        failedLoginWindowStart: true,
        lockoutUntil: true,
      },
    });

    expect(updatedUser?.failedLoginAttempts).toBe(0);
    expect(updatedUser?.failedLoginWindowStart).toBeNull();
    expect(updatedUser?.lockoutUntil).toBeNull();
  });
});
