import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../../middlewares/authenticate";

import { registerSchema } from "./auth.validation";
import { registerService, getMeService } from "./auth.service";
import { loginSchema } from "./auth.validation";
import { loginService } from "./auth.service";
import { ValidationError } from "../../lib/errors";

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message
      throw new ValidationError(message);
    }

    const result = await registerService(parsed.data);

    res.status(201).json({
      status: "success",
      message: "Register successful",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message
      throw new ValidationError(message);
    }

    const { user, token } = await loginService(parsed.data);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    res.status(200).json({
      status: 'success',
      message: 'Logout successful',
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
