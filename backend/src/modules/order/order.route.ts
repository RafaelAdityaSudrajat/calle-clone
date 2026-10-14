import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { validate } from "../../middlewares/validate";
import { listOrdersController } from "./order.controller";
import { listOrdersSchema } from "./order.schema";

const router = Router();

// Semua endpoint order wajib login (BR-01, konsisten dengan cart).
// Tidak ada endpoint publik di modul ini.
router.get("/", authenticate, validate(listOrdersSchema), listOrdersController);

export default router;
