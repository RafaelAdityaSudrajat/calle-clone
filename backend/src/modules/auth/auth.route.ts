import { Router } from "express";
import {
  registerBuyerController,
  verifyEmailController,
  loginController,
  refreshSessionController,
  logoutController,
  getCurrentUserController,
  resendVerificationController,
} from "./auth.controller";
import { authenticate } from "../../middlewares/authenticate";
import { validate } from "../../middlewares/validate";
import {
  loginSchema,
  registerBuyerSchema,
  verifyEmailSchema,
} from "./auth.validation";
import {
  loginRateLimiter,
  registerLimiter,
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

router.post("/resend-verification", authenticate, resendVerificationController);

router.post("/login", loginRateLimiter, validate(loginSchema), loginController);

router.post("/refresh", refreshSessionController);

router.post("/logout", logoutController);

router.get("/me", authenticate, getCurrentUserController);

export default router;
