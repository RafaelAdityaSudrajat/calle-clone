import bcrypt from "bcrypt";
import crypto from "crypto";
import request from "supertest";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { AccountStatus, AuditEvent } from "../../../src/generated/prisma";

import app from "../../../src/app";
import { prisma } from "../../../src/lib/prisma";

import { cleanAuthDatabase } from "../helpers/database";

const TEST_PASSWORD = "Password123";

interface CreateTestUserInput {
  email?: string;
  password?: string;
  status?: AccountStatus;
}

/**
 * Test fixture.
 *
 * Digunakan untuk membuat kondisi awal
 * user tanpa harus melewati endpoint register.
 */
const createTestUser = async ({
  email = `integration-${crypto.randomUUID()}@example.com`,

  password = TEST_PASSWORD,

  status = AccountStatus.ACTIVE,
}: CreateTestUserInput = {}) => {
  /*
   * Cost dibuat rendah supaya test cepat.
   *
   * Kita tidak sedang menguji strength bcrypt,
   * hanya membutuhkan bcrypt hash yang valid.
   */
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

describe("Auth Integration — Login", () => {
  beforeEach(async () => {
    await cleanAuthDatabase();
  });

  afterAll(async () => {
    await cleanAuthDatabase();

    await prisma.$disconnect();
  });

  /**
   * =====================================
   * LOGIN — WRONG PASSWORD
   * =====================================
   */
  it("rejects login when password is incorrect", async () => {
    /*
     * ARRANGE
     */

    const user = await createTestUser();

    /*
     * ACT
     */

    const response = await request(app)
      .post("/api/auth/login")
      .set("User-Agent", "CalleIntegrationTest/1.0")
      .send({
        email: user.email,

        password: "WrongPassword123",
      });

    /*
     * ASSERT HTTP
     */

    expect(response.status).toBe(401);

    expect(response.body.message).toBe("Email atau password salah");

    /*
     * Password salah tidak boleh
     * menghasilkan session.
     */

    const refreshSessionCount = await prisma.refreshToken.count({
      where: {
        userId: user.id,
      },
    });

    expect(refreshSessionCount).toBe(0);

    /*
     * Failed login state harus berubah.
     */

    const updatedUser = await prisma.user.findUnique({
      where: {
        id: user.id,
      },

      select: {
        failedLoginAttempts: true,

        failedLoginWindowStart: true,
      },
    });

    expect(updatedUser?.failedLoginAttempts).toBe(1);

    expect(updatedUser?.failedLoginWindowStart).not.toBeNull();

    /*
     * Kalau LOGIN_FAILED audit
     * sudah kamu implementasikan,
     * kita juga bisa memastikan
     * event tersebut tercatat.
     */

    const audit = await prisma.auditLog.findFirst({
      where: {
        event: AuditEvent.LOGIN_FAILED,

        targetUserId: user.id,
      },
    });

    expect(audit).not.toBeNull();
  });

  /**
   * =====================================
   * LOGIN — UNKNOWN EMAIL
   * =====================================
   */
  it("returns generic credentials error when email does not exist", async () => {
    /*
     * ARRANGE
     */

    const unknownEmail = `unknown-${crypto.randomUUID()}@example.com`;

    /*
     * ACT
     */

    const response = await request(app).post("/api/auth/login").send({
      email: unknownEmail,
      password: TEST_PASSWORD,
    });

    /*
     * ASSERT
     */

    expect(response.status).toBe(401);

    expect(response.body.message).toBe("Email atau password salah");

    /*
     * Login gagal tidak boleh
     * membuat session.
     */

    const sessionCount = await prisma.refreshToken.count();

    expect(sessionCount).toBe(0);
  });

  /**
   * =====================================
   * LOGIN — UNVERIFIED
   * =====================================
   */
  it("allows UNVERIFIED user to login", async () => {
    /*
     * ARRANGE
     */

    const user = await createTestUser({
      status: AccountStatus.UNVERIFIED,
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

    expect(response.body.data.user.status).toBe(AccountStatus.UNVERIFIED);

    /*
     * Session harus benar-benar
     * dibuat.
     */

    const sessionCount = await prisma.refreshToken.count({
      where: {
        userId: user.id,
        revokedAt: null,
      },
    });

    expect(sessionCount).toBe(1);

    /*
     * Cookies auth juga harus
     * diberikan.
     */

    const cookies = response.headers["set-cookie"];

    expect(cookies).toBeDefined();
  });

  /**
   * =====================================
   * LOGIN — SUSPENDED
   * =====================================
   */
  it("rejects SUSPENDED user even when password is correct", async () => {
    /*
     * ARRANGE
     */

    const user = await createTestUser({
      status: AccountStatus.SUSPENDED,
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

    expect(response.status).toBe(409);

    expect(response.body.message).toBe("Akun tidak dapat digunakan");

    /*
     * SUSPENDED user tidak boleh
     * mendapatkan refresh session.
     */

    const sessionCount = await prisma.refreshToken.count({
      where: {
        userId: user.id,
      },
    });

    expect(sessionCount).toBe(0);

    /*
     * Jangan sampai LOGIN_SUCCESS
     * tercatat.
     */

    const loginSuccessAudit = await prisma.auditLog.findFirst({
      where: {
        event: AuditEvent.LOGIN_SUCCESS,

        targetUserId: user.id,
      },
    });

    expect(loginSuccessAudit).toBeNull();
  });
});
