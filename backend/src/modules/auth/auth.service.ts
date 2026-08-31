import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../../lib/prisma";
import { Prisma, AccountStatus, Role } from "../../generated/prisma";
import {
  createEmailVerificationToken,
  createResetPasswordToken,
  hashToken,
} from "./auth.utils";
import {
  sendEmail,
  sendPasswordResetEmail,
} from "../../services/email.service";
import { RegisterBuyerInput } from "./auth.validation";
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  BadRequestError,
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

interface RefreshSessionServiceInput {
  refreshToken: string;

  userAgent?: string;
  ipAddress?: string;
}

interface LogoutServiceInput {
  refreshToken: string;
}

interface ForgotPasswordServiceInput {
  email: string;
}

interface ResetPasswordServiceInput {
  token: string;
  newPassword: string;
}

interface ChangePasswordServiceInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

interface LogoutAllServiceInput {
  userId: string;
}

type RefreshTransactionResult =
  | {
      type: "ROTATED";

      user: {
        id: string;
        email: string;
        role: Role;
        status: AccountStatus;
        sessionVersion: number;
        createdAt: Date;
      };
    }
  | {
      type: "INVALID" | "EXPIRED" | "REVOKED" | "REUSED" | "SUSPENDED";
    };

type ChangePasswordTransactionResult =
  | {
      type: "SUCCESS";
    }
  | {
      type: "STALE_PASSWORD";
    };

type LogoutAllTransactionResult =
  | {
      type: "SUCCESS";
    }
  | {
      type: "USER_NOT_FOUND";
    };

const BCRYPT_SALT_ROUNDS = 12;

const dummyPasswordHashPromise = bcrypt.hash("dummy-login-password-123", 12);

const PASSWORD_HASH_ROUNDS = 12;

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

export const resendVerificationService = async (
  userId: string,
): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
      id: true,
      email: true,
      status: true,
    },
  });

  if (!user) {
    throw new UnauthorizedError("Sesi tidak valid. Silakan login kembali.");
  }

  if (user.status !== AccountStatus.UNVERIFIED) {
    throw new ConflictError("Email sudah diverifikasi.");
  }

  const { token, tokenHash, expiresAt } = createEmailVerificationToken();

  await prisma.user.update({
    where: {
      id: user.id,
    },

    data: {
      emailVerifyTokenHash: tokenHash,

      emailVerifyExpires: expiresAt,
    },
  });

  await sendEmail({
    email: user.email,
    token,
  });
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
      sessionVersion: true,
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
    sessionVersion: user.sessionVersion,
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
              sessionVersion: true,
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
    sessionVersion: result.user.sessionVersion,
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

export const forgotPasswordService = async ({
  email,
}: ForgotPasswordServiceInput): Promise<void> => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },

    select: {
      id: true,
      email: true,
    },
  });

  /*
   * BR-16:
   *
   * Jangan throw:
   *
   * "Email tidak ditemukan"
   *
   * Controller tetap menghasilkan
   * generic response.
   */
  if (!user) {
    return;
  }

  const { token, tokenHash, expiresAt } = createResetPasswordToken();

  /*
   * Setiap forgot-password request baru
   * mengganti token sebelumnya.
   *
   * TOKEN A
   * ↓
   * TOKEN B
   *
   * TOKEN A otomatis invalid.
   */
  await prisma.user.update({
    where: {
      id: user.id,
    },

    data: {
      resetPasswordTokenHash: tokenHash,

      resetPasswordExpires: expiresAt,
    },
  });

  try {
    await sendPasswordResetEmail({
      email: user.email,
      token,
    });
  } catch {
    /*
     * Jangan mengubah response berdasarkan
     * keberadaan account.
     *
     * Jangan log token.
     *
     * Production:
     * gunakan logger + queue/outbox.
     */
    console.error("Failed to send password reset email", {
      userId: user.id,
    });
  }
};

export const resetPasswordService = async ({
  token,
  newPassword,
}: ResetPasswordServiceInput): Promise<void> => {
  const tokenHash = hashToken(token);

  /*
   * bcrypt mahal.
   *
   * Lakukan sebelum membuka DB transaction
   * supaya transaction tidak terbuka terlalu lama.
   */
  const passwordHash = await bcrypt.hash(newPassword, PASSWORD_HASH_ROUNDS);

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    /*
     * Cari kandidat berdasarkan token hash.
     *
     * Field ini @unique di schema.
     */
    const user = await tx.user.findUnique({
      where: {
        resetPasswordTokenHash: tokenHash,
      },

      select: {
        id: true,
      },
    });

    if (!user) {
      return {
        type: "INVALID",
      } as const;
    }

    /*
     * Consume token secara atomic.
     *
     * Token hanya bisa digunakan jika:
     *
     * - hash cocok
     * - belum expired
     *
     * updateMany digunakan supaya
     * race condition menghasilkan count = 0
     * daripada exception.
     */
    const updated = await tx.user.updateMany({
      where: {
        id: user.id,

        resetPasswordTokenHash: tokenHash,

        resetPasswordExpires: {
          gt: now,
        },
      },

      data: {
        passwordHash,

        /*
         * BR-30:
         * token menjadi single-use.
         */
        resetPasswordTokenHash: null,

        resetPasswordExpires: null,

        /*
         * Invalidate seluruh
         * access token lama.
         */
        sessionVersion: {
          increment: 1,
        },
      },
    });

    if (updated.count !== 1) {
      return {
        type: "INVALID",
      } as const;
    }

    /*
     * BR-17:
     *
     * Revoke SEMUA refresh session.
     *
     * Laptop
     * HP
     * browser lain
     * attacker session
     */
    await tx.refreshToken.updateMany({
      where: {
        userId: user.id,

        revokedAt: null,
      },

      data: {
        revokedAt: now,
      },
    });

    return {
      type: "SUCCESS",
    } as const;
  });

  if (result.type === "INVALID") {
    throw new ConflictError(
      "Token reset password tidak valid atau sudah kedaluwarsa",
    );
  }
};

export const changePasswordService = async ({
  userId,
  currentPassword,
  newPassword,
}: ChangePasswordServiceInput): Promise<void> => {
  /*
   * Ambil password hash terbaru dari DB.
   *
   * Jangan pernah return field ini
   * dari controller/API.
   */
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    select: {
      id: true,
      passwordHash: true,
    },
  });

  /*
   * Secara normal authenticate middleware
   * sudah memastikan user ada.
   *
   * Ini defense-in-depth kalau account
   * terhapus setelah authentication.
   */
  if (!user) {
    throw new UnauthorizedError("Sesi tidak valid. Silakan login kembali.");
  }

  /*
   * Re-authentication.
   *
   * BR-18:
   * user wajib membuktikan currentPassword.
   */
  const currentPasswordValid = await bcrypt.compare(
    currentPassword,
    user.passwordHash,
  );

  if (!currentPasswordValid) {
    /*
     * Sengaja 400, bukan 401.
     *
     * 401 di project kita berarti
     * session/access token problem dan
     * bisa memicu silent refresh frontend.
     *
     * Di sini session valid,
     * hanya currentPassword yang salah.
     */
    throw new BadRequestError("Password saat ini salah");
  }

  /*
   * bcrypt termasuk operasi CPU-expensive.
   *
   * Jangan menjalankannya di dalam
   * database transaction agar transaction
   * tidak terbuka terlalu lama.
   */
  const newPasswordHash = await bcrypt.hash(newPassword, PASSWORD_HASH_ROUNDS);

  const now = new Date();

  const result = await prisma.$transaction(
    async (tx): Promise<ChangePasswordTransactionResult> => {
      /*
       * Update password secara conditional.
       *
       * passwordHash lama ikut dimasukkan
       * ke WHERE untuk melindungi kita dari
       * concurrent change-password request.
       */
      const updatedUser = await tx.user.updateMany({
        where: {
          id: user.id,

          /*
           * Pastikan password belum berubah
           * sejak bcrypt.compare tadi.
           */
          passwordHash: user.passwordHash,
        },

        data: {
          passwordHash: newPasswordHash,

          /*
           * Mematikan SEMUA access token
           * yang dibuat dengan
           * sessionVersion sebelumnya.
           */
          sessionVersion: {
            increment: 1,
          },

          /*
           * Security hardening:
           *
           * Kalau sebelumnya user pernah
           * request forgot-password dan
           * reset token masih aktif,
           * password change ini sekaligus
           * mematikannya.
           */
          resetPasswordTokenHash: null,

          resetPasswordExpires: null,
        },
      });

      /*
       * Kalau count != 1,
       * kemungkinan password sudah berubah
       * oleh concurrent request.
       */
      if (updatedUser.count !== 1) {
        return {
          type: "STALE_PASSWORD",
        };
      }

      /*
       * BR-19 / Approach A:
       *
       * Revoke seluruh refresh session,
       * TERMASUK current device.
       */
      await tx.refreshToken.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },

        data: {
          revokedAt: now,
        },
      });

      return {
        type: "SUCCESS",
      };
    },
  );

  if (result.type === "STALE_PASSWORD") {
    throw new ConflictError(
      "Password berubah selama proses. Silakan coba lagi.",
    );
  }
};

export const logoutAllService = async ({
  userId,
}: LogoutAllServiceInput): Promise<void> => {
  const now = new Date();

  const result = await prisma.$transaction(
    async (tx): Promise<LogoutAllTransactionResult> => {
      /*
       * Increment sessionVersion.
       *
       * Semua access token lama masih membawa
       * sessionVersion sebelumnya sehingga
       * langsung menjadi invalid.
       */
      const updatedUser = await tx.user.updateMany({
        where: {
          id: userId,
        },

        data: {
          sessionVersion: {
            increment: 1,
          },
        },
      });

      /*
       * Secara normal authenticate middleware
       * sudah memastikan user tersedia.
       *
       * Ini hanya defense-in-depth apabila
       * user terhapus di antara authentication
       * dan transaction ini.
       */
      if (updatedUser.count !== 1) {
        return {
          type: "USER_NOT_FOUND",
        };
      }

      /*
       * Revoke seluruh refresh session user.
       *
       * Termasuk refresh token dari:
       *
       * - current device
       * - device lain
       * - browser lain
       * - stolen session
       */
      await tx.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
        },

        data: {
          revokedAt: now,
        },
      });

      return {
        type: "SUCCESS",
      };
    },
  );

  if (result.type === "USER_NOT_FOUND") {
    throw new UnauthorizedError("Sesi tidak valid. Silakan login kembali.");
  }
};
