import { Router } from "express";

import authRoute from "../modules/auth/auth.route";
import productRoute from "../modules/product/product.route";
import categoryRoute from "../modules/category/category.route";
import cartRoute from "../modules/cart/cart.route";

const v1Router = Router();

// routes nanti ditambah di sini
v1Router.use("/auth", authRoute);
v1Router.use("/products", productRoute);
v1Router.use("/category", categoryRoute);
v1Router.use("/cart", cartRoute);

export default v1Router;
