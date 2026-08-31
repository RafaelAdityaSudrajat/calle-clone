import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../../middlewares/authenticate";
import {
  registerBuyerService,
  verifyEmailService,
  loginService,
  refreshSessionService,
  logoutService,
  getCurrentUserService,
  resendVerificationService,
  forgotPasswordService,
  resetPasswordService,
  changePasswordService,
} from "./auth.service";
import { UnauthorizedError } from "../../lib/errors";
import catchAsync from "../../lib/catchAsync";
import {
  accessTokenCookieOptions,
  clearAuthCookies,
  refreshTokenCookieOptions,
  setAuthCookies,
} from "./auth.cookie";

export const registerBuyerController = catchAsync(
  async (req: Request, res: Response) => {
    const user = await registerBuyerService(req.body);

    res.status(201).json({
      status: "success",

      message:
        "Registrasi berhasil. Silakan cek email untuk melakukan verifikasi.",

      data: user,
    });
  },
);

export const verifyEmailController = catchAsync(
  async (req: Request, res: Response) => {
    const { token } = req.body;
    console.log(token);

    const result = await verifyEmailService({
      token,
    });

    res.status(200).json({
      status: "success",

      message: "Email berhasil diverifikasi.",

      data: result,
    });
  },
);

export const resendVerificationController = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.auth?.userId;

    if (!userId) {
      throw new UnauthorizedError("Silakan login terlebih dahulu");
    }

    await resendVerificationService(userId);

    res.status(200).json({
      status: "success",
      message: "Email verifikasi berhasil dikirim ulang.",
    });
  },
);

export const loginController = catchAsync(
  async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const result = await loginService({
      email,
      password,

      userAgent: req.get("user-agent") ?? undefined,

      ipAddress: req.ip,
    });

    res.cookie("accessToken", result.accessToken, accessTokenCookieOptions);

    res.cookie("refreshToken", result.refreshToken, refreshTokenCookieOptions);

    res.status(200).json({
      status: "success",

      message: "Login berhasil",

      data: {
        user: result.user,
      },
    });
  },
);

export const refreshSessionController = catchAsync(
  async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.refreshToken;

    /*
     * Token hanya diterima dari cookie,
     * bukan request body.
     */
    if (typeof refreshToken !== "string" || !refreshToken) {
      clearAuthCookies(res);

      throw new UnauthorizedError("Sesi tidak valid. Silakan login kembali.");
    }

    try {
      const result = await refreshSessionService({
        refreshToken,

        userAgent: req.get("user-agent") ?? undefined,

        ipAddress: req.ip,
      });

      /*
       * Replace kedua cookie.
       */
      setAuthCookies(res, {
        accessToken: result.accessToken,

        refreshToken: result.refreshToken,
      });

      res.status(200).json({
        status: "success",

        message: "Sesi berhasil diperbarui",

        data: {
          user: result.user,
        },
      });
    } catch (error) {
      /*
       * Refresh invalid, expired, revoked,
       * reused, atau akun suspended.
       *
       * Browser tidak boleh terus menyimpan
       * cookie session lama.
       */
      clearAuthCookies(res);

      throw error;
    }
  },
);

export const logoutController = catchAsync(
  async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.refreshToken;

    /*
     * Kalau cookie tersedia, cabut token
     * dari database terlebih dahulu.
     */
    if (typeof refreshToken === "string" && refreshToken.length > 0) {
      await logoutService({
        refreshToken,
      });
    }

    /*
     * Cookie baru dihapus setelah operasi
     * database berhasil.
     *
     * Kalau database error, global error handler
     * menangani error dan client bisa mencoba
     * logout kembali.
     */
    clearAuthCookies(res);

    res.status(200).json({
      status: "success",
      message: "Logout berhasil",
    });
  },
);

export const forgotPasswordController = catchAsync(
  async (req: Request, res: Response) => {
    const { email } = req.body;

    await forgotPasswordService({
      email,
    });

    res.status(200).json({
      status: "success",

      message: "Jika email terdaftar, link reset sudah dikirim.",
    });
  },
);

export const resetPasswordController = catchAsync(
  async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;

    await resetPasswordService({
      token,
      newPassword,
    });

    res.status(200).json({
      status: "success",

      message: "Password berhasil direset. Silakan login kembali.",
    });
  },
);

export const changePasswordController = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.auth?.userId;

    /*
     * Normalnya authenticate middleware
     * sudah menjamin ini ada.
     *
     * Defense-in-depth.
     */
    if (!userId) {
      throw new UnauthorizedError("Silakan login terlebih dahulu");
    }

    const { currentPassword, newPassword } = req.body;

    await changePasswordService({
      userId,
      currentPassword,
      newPassword,
    });

    /*
     *
     * Current session juga sudah direvoke.
     * Jadi hapus kedua cookie dari browser.
     */
    clearAuthCookies(res);

    res.status(200).json({
      status: "success",

      message: "Password berhasil diubah. Silakan login kembali.",
    });
  },
);

export const getCurrentUserController = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.auth?.userId;

    /*
     * Secara normal kondisi ini tidak terjadi
     * karena route sudah melewati authenticate.
     *
     * Tetap dicek sebagai defense in depth.
     */
    if (!userId) {
      throw new UnauthorizedError("Silakan login terlebih dahulu");
    }

    const user = await getCurrentUserService(userId);

    res.status(200).json({
      status: "success",

      message: "Berhasil mengambil data user",

      data: {
        user,
      },
    });
  },
);
