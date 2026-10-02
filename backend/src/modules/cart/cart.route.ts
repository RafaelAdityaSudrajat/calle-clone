import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { getCartController } from "./cart.controller";

const router = Router();

router.get("/", authenticate, getCartController);

export default router;
