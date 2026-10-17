import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { validate } from "../../middlewares/validate";
import {
  getOrderByIdController,
  listOrdersController,
} from "./order.controller";
import { getOrderByIdSchema, listOrdersSchema } from "./order.schema";

const router = Router();

// Semua endpoint order wajib login (BR-01, konsisten dengan cart).
// Tidak ada endpoint publik di modul ini.
router.get("/", authenticate, validate(listOrdersSchema), listOrdersController);

router.get(
  "/:orderId",
  authenticate,
  validate(getOrderByIdSchema),
  getOrderByIdController,
);

export default router;
