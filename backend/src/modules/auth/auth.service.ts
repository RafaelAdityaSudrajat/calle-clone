import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../../lib/prisma";
import { Prisma, AccountStatus, Role } from "../../generated/prisma";
import { createEmailVerificationToken, hashToken } from "./auth.utils";
import { sendEmail } from "../../services/email.service";
import { RegisterBuyerInput } from "./auth.validation";
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
} from "../../lib/errors";
import { env } from "../../config/env";
import { recordFailedLoginAttempt } from "./auth.login-security";
import { createAccessToken, createRefreshToken } from "./auth.token";

// auth

interface LoginServiceInput {
  email: string;
  password: string;

  userAgent?: string;
  ipAddress?: string;
}

interface VerifyEmailServiceInput {
  token: string;
}

const BCRYPT_SALT_ROUNDS = 12;

const dummyPasswordHashPromise = bcrypt.hash("dummy-login-password-123", 12);

interface RefreshSessionServiceInput {
  refreshToken: string;

  userAgent?: string;
  ipAddress?: string;
}

interface LogoutServiceInput {
  refreshToken: string;
}

type RefreshTransactionResult =
  | {
      type: "ROTATED";

      user: {
        id: string;
        email: string;
        role: Role;
        status: AccountStatus;
        createdAt: Date;
      };
    }
  | {
      type: "INVALID" | "EXPIRED" | "REVOKED" | "REUSED" | "SUSPENDED";
    };

export const registerBuyerService = async ({
  email,
  password,
}: RegisterBuyerInput) => {
  /*
   * Defense in depth.
   *
   * Validation sudah normalize email,
   * tetapi service tetap melakukan normalization
   * supaya service tidak bergantung 100% pada controller.
   */
  const normalizedEmail = email.trim().toLowerCase();

  const {
    token: emailVerifyToken,
    tokenHash: emailVerifyTokenHash,
    expiresAt: emailVerifyExpires,
  } = createEmailVerificationToken();

  /*
   * BR-04
   *
   * Plaintext password tidak pernah disimpan.
   */
  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  let user;

  try {
    user = await prisma.user.create({
      data: {
        email: normalizedEmail,

        passwordHash,

        /*
         * Jangan ambil role dari request.
         */
        role: Role.BUYER,

        /*
         * User belum boleh checkout
         * sampai email verified.
         */
        status: AccountStatus.UNVERIFIED,

        emailVerifyTokenHash,
        emailVerifyExpires,
      },

      /*
       * Whitelist field response.
       *
       * passwordHash secara otomatis tidak
       * pernah keluar dari service ini.
       */
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
  } catch (error) {
    /*
     * BR-25
     *
     * Jangan:
     *
     * findUnique(email)
     * ↓
     * if (!exists)
     * ↓
     * create()
     *
     * karena ada race condition.
     *
     * Database unique constraint adalah
     * source of truth.
     */
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictError("Email sudah terdaftar");
    }

    throw error;
  }

  /*
   * User sudah berhasil dibuat.
   *
   * Verification token mentah hanya digunakan
   * untuk mengirim verification email.
   */
  try {
    await sendEmail({
      email: user.email,
      token: emailVerifyToken,
    });
  } catch (error) {
    /*
     * Jangan rollback user hanya gara-gara
     * provider email gagal.
     *
     * User tetap UNVERIFIED dan nantinya
     * bisa menggunakan resend verification.
     *
     * Production:
     * log error menggunakan Pino/Winston/Sentry
     * tanpa menyimpan token.
     */

    console.error("Failed to send verification email", {
      userId: user.id,
    });
  }

  return user;
};

export const verifyEmailService = async ({
  token,
}: VerifyEmailServiceInput) => {
  const tokenHash = hashToken(token);

  const now = new Date();

  const result = await prisma.user.updateMany({
    where: {
      emailVerifyTokenHash: tokenHash,

      emailVerifyExpires: {
        gt: now,
      },

      status: AccountStatus.UNVERIFIED,
    },

    data: {
      status: AccountStatus.ACTIVE,

      /*
       * BR-30:
       * token menjadi invalid setelah digunakan.
       */
      emailVerifyTokenHash: null,
      emailVerifyExpires: null,
    },
  });

  if (result.count === 0) {
    throw new ConflictError(
      "Token verifikasi tidak valid atau sudah kedaluwarsa",
    );
  }

  return {
    status: AccountStatus.ACTIVE,
  };
};

export const loginService = async ({
  email,
  password,
  userAgent,
  ipAddress,
}: LoginServiceInput) => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },

    select: {
      id: true,
      email: true,

      passwordHash: true,

      role: true,
      status: true,

      failedLoginAttempts: true,
      failedLoginWindowStart: true,
      lockoutUntil: true,

      createdAt: true,
    },
  });

  /*
   * BR-10:
   *
   * Jangan kasih:
   *
   * "Email tidak ditemukan"
   */
  if (!user) {
    const dummyHash = await dummyPasswordHashPromise;

    await bcrypt.compare(password, dummyHash);

    throw new UnauthorizedError("Email atau password salah");
  }

  const now = new Date();

  /*
   * Account-level lock.
   */
  if (user.lockoutUntil && user.lockoutUntil > now) {
    throw new ConflictError(
      "Terlalu banyak percobaan login. Silakan coba lagi nanti.",
    );
  }

  /*
   * BR-08:
   * compare plaintext password dengan hash.
   */
  const passwordValid = await bcrypt.compare(password, user.passwordHash);

  if (!passwordValid) {
    const loginState = await recordFailedLoginAttempt(user.id);

    if (loginState.locked) {
      throw new ConflictError(
        "Terlalu banyak percobaan login. Silakan coba lagi nanti.",
      );
    }

    /*
     * BR-10
     */
    throw new UnauthorizedError("Email atau password salah");
  }

  /*
   * Password benar dulu baru cek status.
   *
   * Jadi attacker dengan password salah
   * tidak bisa mengetahui status account.
   */
  if (user.status === AccountStatus.SUSPENDED) {
    throw new ConflictError("Akun tidak dapat digunakan");
  }

  /*
   * UNVERIFIED tetap boleh login.
   *
   * Sesuai business rule:
   * verification wajib sebelum checkout,
   * bukan sebelum login/browsing.
   */

  const accessToken = createAccessToken({
    userId: user.id,
    role: user.role,
  });

  const {
    rawToken: refreshToken,
    tokenHash: refreshTokenHash,
    expiresAt: refreshTokenExpiresAt,
  } = createRefreshToken();

  /*
   * Dua perubahan DB yang logically satu operasi:
   *
   * 1. reset login failure
   * 2. create session
   *
   * Maka gunakan transaction.
   */
  await prisma.$transaction([
    prisma.user.update({
      where: {
        id: user.id,
      },

      data: {
        failedLoginAttempts: 0,
        failedLoginWindowStart: null,
        lockoutUntil: null,
      },
    }),

    prisma.refreshToken.create({
      data: {
        tokenHash: refreshTokenHash,

        userId: user.id,

        expiresAt: refreshTokenExpiresAt,

        userAgent: userAgent ?? null,

        ipAddress: ipAddress ?? null,
      },
    }),
  ]);

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    },

    accessToken,
    refreshToken,
  };
};

export const refreshSessionService = async ({
  refreshToken,
  userAgent,
  ipAddress,
}: RefreshSessionServiceInput) => {
  /*
   * Cookie menyimpan token mentah.
   *
   * Database hanya menyimpan hash token.
   */
  const currentTokenHash = hashToken(refreshToken);

  const now = new Date();

  /*
   * Buat kandidat refresh token baru.
   *
   * Token ini baru benar-benar aktif jika
   * transaction berhasil.
   */
  const nextRefreshToken = createRefreshToken();

  const result = await prisma.$transaction(
    async (tx): Promise<RefreshTransactionResult> => {
      const storedToken = await tx.refreshToken.findUnique({
        where: {
          tokenHash: currentTokenHash,
        },

        select: {
          id: true,
          userId: true,

          expiresAt: true,
          revokedAt: true,

          replacedByToken: true,

          user: {
            select: {
              id: true,
              email: true,
              role: true,
              status: true,
              createdAt: true,
            },
          },
        },
      });

      /*
       * Token tidak dikenal.
       *
       * Kita tidak tahu token ini milik user mana,
       * sehingga tidak bisa melakukan revoke-all.
       */
      if (!storedToken) {
        return {
          type: "INVALID",
        };
      }

      /*
       * Token sudah pernah dicabut.
       */
      if (storedToken.revokedAt) {
        /*
         * replacedByToken terisi berarti token ini
         * pernah dirotasi.
         *
         * Kalau digunakan kembali, kemungkinan ada
         * token lama yang dicuri.
         */
        if (storedToken.replacedByToken) {
          await tx.refreshToken.updateMany({
            where: {
              userId: storedToken.userId,

              revokedAt: null,
            },

            data: {
              revokedAt: now,
            },
          });

          return {
            type: "REUSED",
          };
        }

        /*
         * revokedAt terisi tetapi tidak punya
         * replacement, misalnya token sudah
         * dicabut saat logout.
         */
        return {
          type: "REVOKED",
        };
      }

      /*
       * Refresh token sudah expired.
       */
      if (storedToken.expiresAt <= now) {
        await tx.refreshToken.updateMany({
          where: {
            id: storedToken.id,
            revokedAt: null,
          },

          data: {
            revokedAt: now,
          },
        });

        return {
          type: "EXPIRED",
        };
      }

      /*
       * Akun suspended tidak boleh
       * mendapatkan session baru.
       */
      if (storedToken.user.status === AccountStatus.SUSPENDED) {
        await tx.refreshToken.updateMany({
          where: {
            userId: storedToken.userId,

            revokedAt: null,
          },

          data: {
            revokedAt: now,
          },
        });

        return {
          type: "SUSPENDED",
        };
      }

      /*
       * Consume token lama secara atomic.
       *
       * Update hanya berhasil jika token masih:
       * - belum revoked
       * - belum expired
       * - hash-nya cocok
       */
      const consumedToken = await tx.refreshToken.updateMany({
        where: {
          id: storedToken.id,

          tokenHash: currentTokenHash,

          revokedAt: null,

          expiresAt: {
            gt: now,
          },
        },

        data: {
          revokedAt: now,

          /*
           * Menyimpan hash token baru,
           * bukan raw token.
           */
          replacedByToken: nextRefreshToken.tokenHash,
        },
      });

      /*
       * Jika count 0, kemungkinan token yang sama
       * baru saja digunakan oleh request lain.
       *
       * Treat sebagai reuse detection.
       */
      if (consumedToken.count !== 1) {
        await tx.refreshToken.updateMany({
          where: {
            userId: storedToken.userId,

            revokedAt: null,
          },

          data: {
            revokedAt: now,
          },
        });

        return {
          type: "REUSED",
        };
      }

      /*
       * Create session/token pengganti.
       */
      await tx.refreshToken.create({
        data: {
          tokenHash: nextRefreshToken.tokenHash,

          userId: storedToken.userId,

          expiresAt: nextRefreshToken.expiresAt,

          userAgent: userAgent ?? null,

          ipAddress: ipAddress ?? null,
        },
      });

      return {
        type: "ROTATED",

        user: storedToken.user,
      };
    },
  );

  /*
   * Penting:
   *
   * Error dilempar setelah transaction selesai.
   *
   * Kalau kita throw di dalam transaction setelah
   * melakukan revoke-all, seluruh revoke tersebut
   * akan rollback.
   */
  if (result.type === "SUSPENDED") {
    throw new ConflictError("Akun tidak dapat digunakan");
  }

  if (result.type !== "ROTATED") {
    throw new UnauthorizedError("Sesi tidak valid. Silakan login kembali.");
  }

  const accessToken = createAccessToken({
    userId: result.user.id,
    role: result.user.role,
  });

  return {
    user: result.user,

    accessToken,

    refreshToken: nextRefreshToken.rawToken,
  };
};

export const logoutService = async ({
  refreshToken,
}: LogoutServiceInput): Promise<void> => {
  const refreshTokenHash = hashToken(refreshToken);

  /*
   * updateMany dipilih agar logout bersifat idempotent.
   *
   * Kemungkinan hasil:
   *
   * count = 1
   * Token aktif berhasil dicabut.
   *
   * count = 0
   * Token tidak ditemukan atau sudah pernah dicabut.
   *
   * Keduanya tetap dianggap logout berhasil.
   */
  await prisma.refreshToken.updateMany({
    where: {
      tokenHash: refreshTokenHash,
      revokedAt: null,
    },

    data: {
      revokedAt: new Date(),
    },
  });
};

export const getCurrentUserService = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    /*
     * Gunakan whitelist.
     *
     * Jangan return seluruh model User.
     */
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new UnauthorizedError("Sesi tidak valid. Silakan login kembali.");
  }

  return user;
};
