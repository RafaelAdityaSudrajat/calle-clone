"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
require("./config/env");
const app_1 = __importDefault(require("./app"));
const prisma_1 = require("./lib/prisma");
const PORT = process.env.PORT || 5000;
prisma_1.prisma
    .$connect()
    .then(() => console.log("✅ DB connected"))
    .catch((e) => console.error("❌ DB connection failed:", e));
app_1.default.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
