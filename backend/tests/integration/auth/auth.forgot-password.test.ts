import bcrypt from "bcrypt";
import crypto from "crypto";
import request from "supertest";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { AccountStatus, AuditEvent, Role } from "../../../src/generated/prisma";

import app from "../../../src/app";
import { prisma } from "../../../src/lib/prisma";

import { cleanAuthDatabase } from "../helpers/database";

const TEST_PASSWORD = "Password123";

const GENERIC_FORGOT_MESSAGE =
  "Jika email terdaftar, link reset sudah dikirim.";

interface CreateTestUserInput {
  email?: string;
  password?: string;
  status?: AccountStatus;
  role?: Role;
  resetPasswordTokenHash?: string | null;
  resetPasswordExpires?: Date | null;
}

const createTestUser = async ({
  email = `integration-${crypto.randomUUID()}@example.com`,
  password = TEST_PASSWORD,
  status = AccountStatus.ACTIVE,
  role = Role.BUYER,
  resetPasswordTokenHash = null,
  resetPasswordExpires = null,
}: CreateTestUserInput = {}) => {
  const passwordHash = await bcrypt.hash(password, 4);

  return prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      status,
      role,
      resetPasswordTokenHash,
      resetPasswordExpires,
    },
    select: {
      id: true,
      email: true,
      status: true,
      resetPasswordTokenHash: true,
    },
  });
};

const seedActiveSession = async (userId: string) => {
  return prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: crypto.randomBytes(32).toString("hex"),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
};

/**
 * Helper untuk men-simulate cara sistem melakukan hashing pada reset token.
 * Sesuaikan algoritma hash (misal sha256) dengan utilitas di backend kamu.
 */
const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

describe("Auth Integration — Forgot & Reset Password", () => {
  beforeEach(async () => {
    await cleanAuthDatabase();
  });

  afterAll(async () => {
    await cleanAuthDatabase();
    await prisma.$disconnect();
  });

  /**
   * =====================================
   * FORGOT PASSWORD — EXISTING EMAIL
   * =====================================
   */
  it("returns generic message for an existing email and generates reset token", async () => {
    const user = await createTestUser();

    const response = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: user.email });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe(GENERIC_FORGOT_MESSAGE);

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    expect(updatedUser?.resetPasswordTokenHash).not.toBeNull();
    expect(updatedUser?.resetPasswordExpires).not.toBeNull();
    expect(updatedUser?.resetPasswordExpires?.getTime()).toBeGreaterThan(
      Date.now(),
    );
  });

  /**
   * =====================================
   * FORGOT PASSWORD — NON-EXISTING EMAIL
   * =====================================
   */
  it("returns the exact same generic message for a non-existing email", async () => {
    const response = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "ghost-user@example.com" });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe(GENERIC_FORGOT_MESSAGE);
  });

  /**
   * =====================================
   * RESET PASSWORD — HAPPY PATH
   * =====================================
   */
  it("resets password, invalidates all sessions, nullifies token, and logs event", async () => {
    /*
     * ARRANGE
     */
    const validRawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = hashToken(validRawToken);

    const user = await createTestUser({
      resetPasswordTokenHash: hashedToken,
      resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000),
    });

    // Simulasi user login di 2 device berbeda
    await seedActiveSession(user.id);
    await seedActiveSession(user.id);

    const newPassword = "NewStrongPassword123";

    /*
     * ACT
     * Kirim raw token via request, biar controller yang validasi hash-nya.
     */
    const response = await request(app).post("/api/auth/reset-password").send({
      token: validRawToken,
      newPassword,
    });

    /*
     * ASSERT HTTP
     */
    expect(response.status).toBe(200);

    /*
     * ASSERT DATABASE (PASSWORD)
     */
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    const isPasswordChanged = await bcrypt.compare(
      newPassword,
      updatedUser!.passwordHash,
    );
    expect(isPasswordChanged).toBe(true);

    /*
     * ASSERT DATABASE (TOKEN INVALIDATION)
     */
    expect(updatedUser?.resetPasswordTokenHash).toBeNull();
    expect(updatedUser?.resetPasswordExpires).toBeNull();

    /*
     * ASSERT DATABASE (SESSIONS)
     * Force logout semua device[cite: 1].
     */
    const activeSessions = await prisma.refreshToken.count({
      where: { userId: user.id, revokedAt: null },
    });
    expect(activeSessions).toBe(0);

    /*
     * ASSERT AUDIT LOG
     */
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        event: AuditEvent.PASSWORD_RESET_SUCCESS,
        targetUserId: user.id, // Menggunakan relasi auditEventsAsTarget
      },
    });
    expect(auditLog).not.toBeNull();
  });

  /**
   * =====================================
   * RESET PASSWORD — EXPIRED TOKEN
   * =====================================
   */
  it("rejects reset password attempt if token is expired", async () => {
    const expiredRawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = hashToken(expiredRawToken);

    const user = await createTestUser({
      resetPasswordTokenHash: hashedToken,
      resetPasswordExpires: new Date(Date.now() - 5000), // Sudah expired
    });

    const response = await request(app).post("/api/auth/reset-password").send({
      token: expiredRawToken,
      newPassword: "NewStrongPassword123",
    });

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/kedaluwarsa|tidak valid/i);
  });
});
