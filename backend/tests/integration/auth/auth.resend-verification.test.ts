import bcrypt from "bcrypt";
import crypto from "crypto";
import request from "supertest";

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountStatus } from "../../../src/generated/prisma";

import { prisma } from "../../../src/lib/prisma";

import { cleanAuthDatabase } from "../helpers/database";

const TEST_PASSWORD = "Password123";

/*
 * Mock email service — sama seperti
 * di auth.lifecycle.test.ts.
 */
const emailMocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),

  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("../../../src/services/email.service.ts", () => ({
  sendEmail: emailMocks.sendEmail,

  sendPasswordResetEmail: emailMocks.sendPasswordResetEmail,
}));

/*
 * Import app SETELAH deklarasi mock.
 */
import app from "../../../src/app";

interface CreateTestUserInput {
  email?: string;
  password?: string;
  status?: AccountStatus;
}

const createTestUser = async ({
  email = `integration-${crypto.randomUUID()}@example.com`,

  password = TEST_PASSWORD,

  status = AccountStatus.UNVERIFIED,
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
      emailVerifyTokenHash: true,
      emailVerifyExpires: true,
    },
  });
};

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

/*
 * UNVERIFIED user tetap boleh login (BR terkait login),
 * jadi kita bisa dapat accessToken tanpa perlu
 * endpoint /me.
 */
const loginAndGetAccessToken = async (email: string) => {
  const response = await request(app).post("/api/auth/login").send({
    email,
    password: TEST_PASSWORD,
  });

  return extractCookieValue(response, "accessToken");
};

const callResendVerification = async (accessToken?: string) => {
  const req = request(app).post("/api/auth/resend-verification");

  if (accessToken) {
    req.set("Cookie", [`accessToken=${accessToken}`]);
  }

  return req;
};

describe("Auth Integration — Resend Verification", () => {
  beforeEach(async () => {
    await cleanAuthDatabase();

    vi.clearAllMocks();
  });

  afterAll(async () => {
    await cleanAuthDatabase();

    await prisma.$disconnect();
  });

  /**
   * =====================================
   * HAPPY PATH
   * =====================================
   */
  it("issues a new verification token for an UNVERIFIED user", async () => {
    /*
     * ARRANGE
     */

    const user = await createTestUser();

    const accessToken = await loginAndGetAccessToken(user.email);

    /*
     * ACT
     */

    const response = await callResendVerification(accessToken);

    /*
     * ASSERT HTTP
     */

    expect(response.status).toBe(200);

    /*
     * ASSERT EMAIL
     */

    expect(emailMocks.sendEmail).toHaveBeenCalledTimes(1);

    const sentEmail = emailMocks.sendEmail.mock.calls[0]?.[0] as {
      email: string;
      token: string;
    };

    expect(sentEmail.email).toBe(user.email);
    expect(sentEmail.token).toBeTruthy();

    /*
     * ASSERT DATABASE
     */

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },

      select: {
        emailVerifyTokenHash: true,
        emailVerifyExpires: true,
      },
    });

    expect(updatedUser?.emailVerifyTokenHash).not.toBeNull();

    expect(updatedUser?.emailVerifyExpires).not.toBeNull();

    expect(updatedUser!.emailVerifyExpires!.getTime()).toBeGreaterThan(
      Date.now(),
    );
  });

  /**
   * =====================================
   * ALREADY VERIFIED
   * =====================================
   */
  it("rejects resend for an already-verified (ACTIVE) user", async () => {
    /*
     * ARRANGE
     */

    const user = await createTestUser({
      status: AccountStatus.ACTIVE,
    });

    const accessToken = await loginAndGetAccessToken(user.email);

    /*
     * ACT
     */

    const response = await callResendVerification(accessToken);

    /*
     * ASSERT HTTP
     */

    expect(response.status).toBe(409);

    expect(response.body.message).toBe("Email sudah diverifikasi.");

    /*
     * ASSERT — tidak ada email terkirim,
     * tidak ada perubahan token.
     */

    expect(emailMocks.sendEmail).not.toHaveBeenCalled();

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },

      select: { emailVerifyTokenHash: true },
    });

    expect(updatedUser?.emailVerifyTokenHash).toBeNull();
  });

  /**
   * =====================================
   * UNAUTHENTICATED
   * =====================================
   */
  it("rejects resend when not authenticated", async () => {
    const response = await callResendVerification(undefined);

    expect(response.status).toBe(401);

    expect(emailMocks.sendEmail).not.toHaveBeenCalled();
  });

  /**
   * =====================================
   * OLD TOKEN INVALIDATED (BR-30)
   * =====================================
   */
  it("invalidates the previous verification token once resend is called", async () => {
    /*
     * ARRANGE — register lewat endpoint asli
     * supaya dapat token verifikasi ASLI yang
     * pertama (token1).
     */

    const email = `integration-${crypto.randomUUID()}@example.com`;

    await request(app).post("/api/auth/register").send({
      email,
      password: TEST_PASSWORD,
    });

    const token1 = (
      emailMocks.sendEmail.mock.calls[0]?.[0] as { token: string }
    ).token;

    const accessToken = await loginAndGetAccessToken(email);

    /*
     * ACT #1 — resend, dapat token2.
     */

    await callResendVerification(accessToken);

    const token2 = (
      emailMocks.sendEmail.mock.calls[1]?.[0] as { token: string }
    ).token;

    expect(token2).not.toBe(token1);

    /*
     * ACT #2 — coba verifikasi pakai
     * token LAMA (token1). Harus GAGAL.
     */

    const verifyWithOldToken = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: token1 });

    expect(verifyWithOldToken.status).toBe(409);

    /*
     * ACT #3 — verifikasi pakai token
     * BARU (token2). Harus BERHASIL.
     */

    const verifyWithNewToken = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: token2 });

    expect(verifyWithNewToken.status).toBe(200);

    const finalUser = await prisma.user.findUnique({
      where: { email },
      select: { status: true },
    });

    expect(finalUser?.status).toBe(AccountStatus.ACTIVE);
  });
});
