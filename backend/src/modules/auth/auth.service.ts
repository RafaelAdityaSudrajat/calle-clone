import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../../lib/prisma";
import { Prisma, AccountStatus, Role } from "../../generated/prisma";
import { generateSecureToken, hashToken } from "./auth.utils";
import { sendVerificationEmail } from "../../services/email.service";
import { RegisterBuyerInput } from "./auth.validation";
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
} from "../../lib/errors";
import { env } from "../../config/env";

// auth

interface VerifyEmailServiceInput {
  token: string;
}

const BCRYPT_SALT_ROUNDS = 12;

const EMAIL_VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000;

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

  /*
   * BR-04
   *
   * Plaintext password tidak pernah disimpan.
   */
  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  /*
   * Token yang dikirim ke user.
   */
  const emailVerifyToken = generateSecureToken();

  /*
   * Token yang masuk database.
   */
  const emailVerifyTokenHash = hashToken(emailVerifyToken);

  const emailVerifyExpires = new Date(
    Date.now() + EMAIL_VERIFICATION_EXPIRY_MS,
  );

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
    await sendVerificationEmail({
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

// export const registerService = async (input: RegisterInput) => {
//   const existingUser = await prisma.user.findUnique({
//     where: { email: input.email },
//   });

//   if (existingUser) {
//     throw new ConflictError("Email already registered");
//   }

//   const hashedPassword = await bcrypt.hash(input.password, 10);

//   const user = await prisma.user.create({
//     data: {
//       fullName: input.fullName,
//       email: input.email,
//       password: hashedPassword,
//     },
//     select: {
//       id: true,
//       fullName: true,
//       email: true,
//       createdAt: true,
//     },
//   });

//   const token = jwt.sign({ id: user.id }, env.JWT_SECRET, {
//     expiresIn: "7d",
//   });

//   return { user, token };
// };

export const loginService = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.password);

  if (!isPasswordValid) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const token = jwt.sign({ id: user.id }, env.JWT_SECRET, {
    expiresIn: "7d",
  });

  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      createdAt: user.createdAt,
    },
    token,
  };
};

// user

export const getMeService = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new NotFoundError("User not found");
  }

  return user;
};
