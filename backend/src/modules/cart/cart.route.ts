import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import {
  addToCartController,
  checkoutController,
  getCartController,
  removeCartItemController,
  updateCartItemController,
} from "./cart.controller";
import { validate } from "../../middlewares/validate";
import {
  addToCartSchema,
  checkoutSchema,
  removeCartItemSchema,
  updateCartItemSchema,
} from "./cart.schema";
import {
  cartAddLimiter,
  cartCheckoutLimiter,
} from "../../middlewares/limitRequest";

const router = Router();

router.get("/", authenticate, getCartController);
router.post(
  "/",
  authenticate,
  cartAddLimiter,
  validate(addToCartSchema),
  addToCartController,
);

router.post(
  "/checkout",
  authenticate,
  cartCheckoutLimiter,
  validate(checkoutSchema),
  checkoutController,
);
router.patch(
  "/:cartItemId",
  authenticate,
  validate(updateCartItemSchema),
  updateCartItemController,
);
router.delete(
  "/:cartItemId",
  authenticate,
  validate(removeCartItemSchema),
  removeCartItemController,
);

export default router;
