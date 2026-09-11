import bcrypt from "bcrypt";
import crypto from "crypto";
import request from "supertest";

// Sesuaikan path import ini jika struktur foldermu ada yang berbeda
import app from "../../../src/app";
import { prisma } from "../../../src/lib/prisma";
import { AccountStatus, Role } from "../../../src/generated/prisma";

// Diekspor agar tes lain bisa menggunakan password default ini tanpa harus hardcode
export const TEST_PASSWORD = "Password123";

export interface CreateTestUserInput {
  email?: string;
  password?: string;
  status?: AccountStatus;
  role?: Role;
  sessionVersion?: number;
}

/**
 * Membuat user langsung ke database tanpa melewati endpoint API.
 * Berguna untuk tahap ARRANGE dalam testing.
 */
export const createTestUser = async ({
  email = `integration-${crypto.randomUUID()}@example.com`,
  password = TEST_PASSWORD,
  status = AccountStatus.ACTIVE, // Default ACTIVE agar bisa langsung dipakai belanja/login
  role = Role.BUYER,
  sessionVersion = 0,
}: CreateTestUserInput = {}) => {
  // Hash sangat ringan (saltRounds=4) khusus untuk mempercepat jalannya eksekusi testing
  const passwordHash = await bcrypt.hash(password, 4);

  return prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      status,
      role,
      sessionVersion,
    },
  });
};

/**
 * Melakukan login via endpoint asli API untuk mendapatkan Token Cookie.
 * Berguna untuk simulasi user yang sudah terotentikasi.
 */
export const loginTestUser = async (
  email: string,
  password = TEST_PASSWORD,
) => {
  const response = await request(app).post("/api/auth/login").send({
    email,
    password,
  });

  const setCookieHeader = response.headers["set-cookie"];

  // Normalisasi agar selalu menjadi Array of Strings (mencegah crash)
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

  // Helper kecil untuk mengambil token value-nya saja tanpa nama cookie-nya
  const getCookieValue = (rawCookie?: string) => {
    return rawCookie ? rawCookie.split(";")[0].split("=")[1] : "";
  };

  return {
    // Format utuh (misal: "accessToken=xyz123") untuk disuntikkan ke request.set("Cookie", [...])
    accessTokenCookie: accessTokenCookieRaw
      ? accessTokenCookieRaw.split(";")[0]
      : "",
    refreshTokenCookie: refreshTokenCookieRaw
      ? refreshTokenCookieRaw.split(";")[0]
      : "",

    // Format murni (misal: "xyz123") jika sewaktu-waktu kamu perlu mengecek token ini ke database
    refreshTokenValue: getCookieValue(refreshTokenCookieRaw),
  };
};
