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
  sessionVersion?: number;
}

const createTestUser = async ({
  email = `integration-${crypto.randomUUID()}@example.com`,
  password = TEST_PASSWORD,
  status = AccountStatus.ACTIVE,
  role = Role.BUYER,
  sessionVersion = 0,
}: CreateTestUserInput = {}) => {
  const passwordHash = await bcrypt.hash(password, 4);

  return prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      status,
      role,
      sessionVersion,
    },
    select: {
      id: true,
      email: true,
      status: true,
      sessionVersion: true,
    },
  });
};

/**
 * Helper untuk login dan mendapatkan token otentikasi
 * karena endpoint ini butuh middleware `authenticate`.
 */
const loginTestUser = async (email: string, password = TEST_PASSWORD) => {
  const response = await request(app).post("/api/auth/login").send({
    email,
    password,
  });

  const setCookieHeader = response.headers["set-cookie"] || [];

  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];

  const accessTokenCookie = cookies.find((c: string) =>
    c.startsWith("accessToken="),
  );
  const refreshTokenCookie = cookies.find((c: string) =>
    c.startsWith("refreshToken="),
  );

  return {
    accessTokenCookie: accessTokenCookie ? accessTokenCookie.split(";")[0] : "",
    refreshTokenCookie: refreshTokenCookie
      ? refreshTokenCookie.split(";")[0]
      : "",
  };
};

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

describe("Auth Integration — Change Password", () => {
  const changePasswordEndpoint = "/api/auth/change-password";

  beforeEach(async () => {
    await cleanAuthDatabase();
  });

  afterAll(async () => {
    await cleanAuthDatabase();
    await prisma.$disconnect();
  });

  /**
   * =====================================
   * CHANGE PASSWORD — HAPPY PATH
   * =====================================
   */
  it("successfully changes password, increments sessionVersion, logs event, and invalidates other sessions", async () => {
    /*
     * ARRANGE
     */
    const user = await createTestUser({ sessionVersion: 1 });
    const { accessTokenCookie } = await loginTestUser(
      user.email,
      TEST_PASSWORD,
    );

    // Simulasi device lain yang sedang login
    await seedActiveSession(user.id);

    const newPassword = "NewStrongPassword123!";

    /*
     * ACT
     */
    const response = await request(app)
      .patch(changePasswordEndpoint)
      .set("Cookie", [accessTokenCookie]) // Bypass authenticate middleware
      .send({
        currentPassword: TEST_PASSWORD,
        newPassword,
      });

    /*
     * ASSERT HTTP
     */
    expect(response.status).toBe(200);

    /*
     * ASSERT DATABASE (PASSWORD & SESSION VERSION)
     */
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    // Password baru harus tersimpan dalam bentuk hash
    const isPasswordChanged = await bcrypt.compare(
      newPassword,
      updatedUser!.passwordHash,
    );
    expect(isPasswordChanged).toBe(true);

    // sessionVersion harus bertambah untuk membatalkan JWT yang lama
    expect(updatedUser?.sessionVersion).toBeGreaterThan(user.sessionVersion);

    /*
     * ASSERT DATABASE (SESSIONS)
     * BR-19: sukses ganti password → invalidate semua sesi lain
     */
    const activeSessions = await prisma.refreshToken.count({
      where: { userId: user.id, revokedAt: null },
    });

    // Asumsi: Semua refresh token lama dihapus / di-revoke
    expect(activeSessions).toBe(0);

    /*
     * ASSERT AUDIT LOG
     */
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        event: AuditEvent.PASSWORD_CHANGED,
        actorUserId: user.id, // User yang mengubah passwordnya sendiri
      },
    });
    expect(auditLog).not.toBeNull();
  });

  /**
   * =====================================
   * CHANGE PASSWORD — WRONG CURRENT PASSWORD
   * =====================================
   */
  it("rejects attempt if the current password provided is incorrect", async () => {
    const user = await createTestUser();
    const { accessTokenCookie } = await loginTestUser(
      user.email,
      TEST_PASSWORD,
    );

    const response = await request(app)
      .patch(changePasswordEndpoint)
      .set("Cookie", [accessTokenCookie])
      .send({
        currentPassword: "WrongCurrentPassword123!",
        newPassword: "NewStrongPassword123!",
      });

    // Zod lolos, tapi service layer menolak
    expect(response.status).toBe(400); // Atau 401, sesuaikan dengan logic controller
    expect(response.body.message).toMatch(/Password saat ini salah|incorrect/i);
  });

  /**
   * =====================================
   * CHANGE PASSWORD — ZOD VALIDATION FAIL
   * =====================================
   */
  it("rejects attempt if the new password does not meet security criteria", async () => {
    const user = await createTestUser();
    const { accessTokenCookie } = await loginTestUser(
      user.email,
      TEST_PASSWORD,
    );

    const response = await request(app)
      .patch(changePasswordEndpoint)
      .set("Cookie", [accessTokenCookie])
      .send({
        currentPassword: TEST_PASSWORD,
        newPassword: "weak", // Gagal validasi Zod (min 8 karakter, huruf & angka)
      });

    expect(response.status).toBe(400);
  });

  /**
   * =====================================
   * CHANGE PASSWORD — UNAUTHENTICATED
   * =====================================
   */
  it("rejects attempt if user is not authenticated", async () => {
    // Tidak melampirkan cookie/token
    const response = await request(app).patch(changePasswordEndpoint).send({
      currentPassword: TEST_PASSWORD,
      newPassword: "NewStrongPassword123!",
    });

    expect(response.status).toBe(401);
  });
});
