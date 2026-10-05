import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { addToCartController, getCartController } from "./cart.controller";
import { validate } from "../../middlewares/validate";
import { addToCartSchema } from "./cart.schema";

const router = Router();

router.get("/", authenticate, getCartController);
router.post("/", authenticate, validate(addToCartSchema), addToCartController);

export default router;
