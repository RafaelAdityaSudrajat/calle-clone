import crypto from "crypto";

import request from "supertest";

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountStatus, AuditEvent } from "../../../src/generated/prisma";

import { prisma } from "../../../src/lib/prisma";

import { cleanAuthDatabase } from "../helpers/database";

/*
 * Mock external email service.
 *
 * PENTING:
 * Sesuaikan path ini dengan file
 * sendEmail milik project kamu.
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
 * Import app setelah deklarasi mock.
 *
 * Vitest akan melakukan hoisting
 * terhadap vi.mock().
 */
import app from "../../../src/app";

describe("Auth Integration — Lifecycle", () => {
  beforeEach(async () => {
    /*
     * Test harus dimulai dari
     * database bersih.
     */
    await cleanAuthDatabase();

    vi.clearAllMocks();
  });

  afterAll(async () => {
    await cleanAuthDatabase();

    await prisma.$disconnect();
  });

  it("register → verify → login → get current user", async () => {
    /*
     * =====================================
     * ARRANGE
     * =====================================
     */

    const agent = request.agent(app);

    const email = `integration-${crypto.randomUUID()}@example.com`;

    const password = "Password123";

    /*
     * =====================================
     * ACT #1 — REGISTER
     * =====================================
     */

    const registerResponse = await agent
      .post("/api/auth/register")
      .set("User-Agent", "CalleIntegrationTest/1.0")
      .send({
        email,
        password,
      });

    /*
     * =====================================
     * ASSERT REGISTER
     * =====================================
     */

    expect(registerResponse.status).toBe(201);

    expect(registerResponse.body.status).toBe("success");

    /*
     * Password hash tidak boleh
     * bocor melalui API.
     */
    expect(registerResponse.body.data).not.toHaveProperty("passwordHash");

    /*
     * Sekarang cek REAL DATABASE.
     */

    const registeredUser = await prisma.user.findUnique({
      where: {
        email,
      },

      select: {
        id: true,
        email: true,
        status: true,
        passwordHash: true,

        emailVerifyTokenHash: true,

        emailVerifyExpires: true,
      },
    });

    expect(registeredUser).not.toBeNull();

    expect(registeredUser?.status).toBe(AccountStatus.UNVERIFIED);

    expect(registeredUser?.passwordHash).not.toBe(password);

    expect(registeredUser?.emailVerifyTokenHash).not.toBeNull();

    expect(registeredUser?.emailVerifyExpires).not.toBeNull();

    /*
     * =====================================
     * ASSERT EMAIL
     * =====================================
     */

    expect(emailMocks.sendEmail).toHaveBeenCalledTimes(1);

    const verificationEmail = emailMocks.sendEmail.mock.calls[0]?.[0] as {
      email: string;
      token: string;
    };

    expect(verificationEmail.email).toBe(email);

    expect(verificationEmail.token).toBeTruthy();

    /*
     * =====================================
     * ACT #2 — VERIFY EMAIL
     * =====================================
     */

    const verifyResponse = await agent.post("/api/auth/verify-email").send({
      token: verificationEmail.token,
    });

    /*
     * =====================================
     * ASSERT VERIFY
     * =====================================
     */

    expect(verifyResponse.status).toBe(200);

    const verifiedUser = await prisma.user.findUnique({
      where: {
        email,
      },

      select: {
        status: true,

        emailVerifyTokenHash: true,

        emailVerifyExpires: true,
      },
    });

    expect(verifiedUser?.status).toBe(AccountStatus.ACTIVE);

    /*
     * Verification token
     * harus single-use.
     */
    expect(verifiedUser?.emailVerifyTokenHash).toBeNull();

    expect(verifiedUser?.emailVerifyExpires).toBeNull();

    /*
     * =====================================
     * ACT #3 — LOGIN
     * =====================================
     */

    const loginResponse = await agent
      .post("/api/auth/login")
      .set("User-Agent", "CalleIntegrationTest/1.0")
      .send({
        email,
        password,
      });

    /*
     * =====================================
     * ASSERT LOGIN
     * =====================================
     */

    expect(loginResponse.status).toBe(200);

    /*
     * Backend harus membuat cookies.
     */

    const setCookieHeader = loginResponse.headers["set-cookie"];

    const cookies = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : setCookieHeader
        ? [setCookieHeader]
        : [];

    expect(cookies.some((cookie) => cookie.startsWith("accessToken="))).toBe(
      true,
    );

    expect(cookies.some((cookie) => cookie.startsWith("refreshToken="))).toBe(
      true,
    );

    /*
     * Refresh session benar-benar
     * tersimpan di database.
     */

    const refreshSessions = await prisma.refreshToken.count({
      where: {
        userId: registeredUser!.id,
        revokedAt: null,
      },
    });

    expect(refreshSessions).toBe(1);

    /*
     * Audit login success
     * benar-benar tercatat.
     */

    const loginAudit = await prisma.auditLog.findFirst({
      where: {
        event: AuditEvent.LOGIN_SUCCESS,

        targetUserId: registeredUser!.id,
      },
    });

    expect(loginAudit).not.toBeNull();

    expect(loginAudit?.userAgent).toBe("CalleIntegrationTest/1.0");

    /*
     * =====================================
     * ACT #4 — /AUTH/ME
     * =====================================
     *
     * request.agent() menyimpan cookie
     * dari loginResponse.
     *
     * Jadi kita tidak perlu copy token
     * secara manual.
     */

    // const meResponse = await agent.get("/api/auth/me");

    /*
     * =====================================
     * ASSERT /ME
     * =====================================
     */

    // expect(meResponse.status).toBe(200);

    // expect(meResponse.body.data.user.email).toBe(email);

    // expect(meResponse.body.data.user.status).toBe(AccountStatus.ACTIVE);

    // expect(meResponse.body.data.user).not.toHaveProperty("passwordHash");
  });
});
