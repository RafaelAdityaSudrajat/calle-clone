import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import morgan from "morgan";

import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import v1Router from "./routes/v1.router";

const app = express();

app.use(morgan("dev"));
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// routes nanti ditambah di sini
app.use("/api/v1", v1Router);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
