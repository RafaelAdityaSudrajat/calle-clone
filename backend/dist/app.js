"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
require("dotenv/config");
const auth_route_1 = __importDefault(require("./modules/auth/auth.route"));
const product_route_1 = __importDefault(require("./modules/product/product.route"));
const category_route_1 = __importDefault(require("./modules/category/category.route"));
const errorHandler_1 = require("./middlewares/errorHandler");
const app = (0, express_1.default)();
app.use(express_1.default.json());
// routes nanti ditambah di sini
app.use("/api/auth", auth_route_1.default);
app.use("/api/products", product_route_1.default);
app.use("/api/category", category_route_1.default);
app.use(errorHandler_1.notFoundHandler);
app.use(errorHandler_1.errorHandler);
exports.default = app;
