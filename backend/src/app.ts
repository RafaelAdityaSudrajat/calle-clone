import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoute from "./modules/auth/auth.route";
import productRoute from "./modules/product/product.route";
import categoryRoute from "./modules/category/category.route";
import cartRoute from "./modules/cart/cart.route";

import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// routes nanti ditambah di sini
app.use("/api/auth", authRoute);
app.use("/api/products", productRoute);
app.use("/api/category", categoryRoute);
app.use("/api/cart", cartRoute);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
