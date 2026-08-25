import { Request, Response, NextFunction } from "express";
import { AccountStatus } from "../generated/prisma";
import { prisma } from "../lib/prisma";
import catchAsync from "../lib/catchAsync";
import { ConflictError, UnauthorizedError } from "../lib/errors";
import { verifyAccessToken } from "../modules/auth/auth.token";

export interface AuthRequest extends Request {
  userId?: string;
}

export const authenticate = catchAsync(
  async (req: Request, _res: Response, next: NextFunction) => {
    const accessToken = req.cookies?.accessToken;

    if (typeof accessToken !== "string" || accessToken.length === 0) {
      throw new UnauthorizedError("Silakan login terlebih dahulu");
    }

    let payload;

    try {
      payload = verifyAccessToken(accessToken);
    } catch {
      /*
       * Jangan mengirim detail seperti:
       *
       * - jwt expired
       * - invalid signature
       * - malformed token
       *
       * Client hanya perlu tahu bahwa
       * access token tidak valid.
       */
      throw new UnauthorizedError("Sesi tidak valid atau telah kedaluwarsa");
    }

    /*
     * Jangan hanya mempercayai role dan status
     * dari JWT.
     *
     * Ambil user terbaru dari database supaya:
     *
     * - akun yang sudah dihapus ditolak
     * - perubahan role langsung diketahui
     * - akun SUSPENDED langsung ditolak
     */
    const user = await prisma.user.findUnique({
      where: {
        id: payload.sub,
      },

      select: {
        id: true,
        role: true,
        status: true,
        sessionVersion: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError("Sesi tidak valid. Silakan login kembali.");
    }

    if (user.status === AccountStatus.SUSPENDED) {
      throw new ConflictError("Akun tidak dapat digunakan");
    }

    if (payload.sessionVersion !== user.sessionVersion) {
      throw new UnauthorizedError("Sesi tidak valid. Silakan login kembali.");
    }

    req.auth = {
      userId: user.id,

      /*
       * Gunakan role terbaru dari DB,
       * bukan role lama dari JWT.
       */
      role: user.role,

      status: user.status,
    };

    next();
  },
);
