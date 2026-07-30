import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../../middlewares/authenticate";
import { RegisterBuyerInput } from "./auth.validation";
import {
  registerBuyerService,
  getMeService,
  verifyEmailService,
} from "./auth.service";
import { loginService } from "./auth.service";
import { ValidationError } from "../../lib/errors";
import catchAsync from "../../lib/catchAsync";

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

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message;
      throw new ValidationError(message);
    }

    const { user, token } = await loginService(parsed.data);

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      status: "success",
      message: "Login successful",
      data: { user, token },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.status(200).json({
      status: "success",
      message: "Logout successful",
    });
  } catch (error) {
    next(error);
  }
};

// user

export const getMe = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await getMeService(req.userId!);

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
