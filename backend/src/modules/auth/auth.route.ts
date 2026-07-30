import { Router } from "express";
import {
  login,
  getMe,
  logout,
  registerBuyerController,
  verifyEmailController,
} from "./auth.controller";
import { authenticate } from "../../middlewares/authenticate";
import { validate } from "../../middlewares/validate";
import { registerBuyerSchema, verifyEmailSchema } from "./auth.validation";

const router = Router();

router.post(
  "/register",
  authenticate,
  validate(registerBuyerSchema),
  registerBuyerController,
);
router.post(
  "/verify-email",
  validate(verifyEmailSchema),
  verifyEmailController,
);
router.post("/login", login);
router.post("/logout", authenticate, logout);
router.get("/me", authenticate, getMe);

export default router;
