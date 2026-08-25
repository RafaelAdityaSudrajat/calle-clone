import { Router } from "express";
import {
  registerBuyerController,
  verifyEmailController,
  loginController,
  refreshSessionController,
  logoutController,
  getCurrentUserController,
  resendVerificationController,
  forgotPasswordController,
  resetPasswordController,
} from "./auth.controller";
import { authenticate } from "../../middlewares/authenticate";
import { validate } from "../../middlewares/validate";
import {
  forgotPasswordSchema,
  loginSchema,
  registerBuyerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "./auth.validation";
import {
  forgotPasswordLimiter,
  loginRateLimiter,
  registerLimiter,
  resendVerificationLimiter,
  resetPasswordLimiter,
} from "../../middlewares/limitRequest";

const router = Router();

router.post(
  "/register",
  registerLimiter,
  validate(registerBuyerSchema),
  registerBuyerController,
);

router.post(
  "/verify-email",
  validate(verifyEmailSchema),
  verifyEmailController,
);

router.post(
  "/resend-verification",
  resendVerificationLimiter,
  authenticate,
  resendVerificationController,
);

router.post("/login", loginRateLimiter, validate(loginSchema), loginController);

router.post("/refresh", refreshSessionController);

router.post("/logout", logoutController);

router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  forgotPasswordController,
);

router.post(
  "/reset-password",
  resetPasswordLimiter,
  validate(resetPasswordSchema),
  resetPasswordController,
);

router.get("/me", authenticate, getCurrentUserController);

export default router;
