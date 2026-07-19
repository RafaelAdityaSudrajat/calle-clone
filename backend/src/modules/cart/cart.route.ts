import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { addToCartController, getCartByUserIdController } from "./cart.controller";

const router = Router();

router.post("/", authenticate, addToCartController);
router.get("/", authenticate, getCartByUserIdController);

export default router;
