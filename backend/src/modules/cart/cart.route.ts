import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import {
  addToCartController,
  getCartController,
  updateCartItemController,
} from "./cart.controller";
import { validate } from "../../middlewares/validate";
import { addToCartSchema, updateCartItemSchema } from "./cart.schema";

const router = Router();

router.get("/", authenticate, getCartController);
router.post("/", authenticate, validate(addToCartSchema), addToCartController);
router.patch(
  "/:cartItemId",
  authenticate,
  validate(updateCartItemSchema),
  updateCartItemController,
);

export default router;
