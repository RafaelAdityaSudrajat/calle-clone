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

const router = Router();

router.get("/", authenticate, getCartController);
router.post("/", authenticate, validate(addToCartSchema), addToCartController);
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

router.post(
  "/checkout",
  authenticate,
  validate(checkoutSchema),
  checkoutController,
);

export default router;
