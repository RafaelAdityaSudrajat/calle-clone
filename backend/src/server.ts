import "dotenv/config";
import "./config/env";
import app from "./app";
import { prisma } from "./lib/prisma";

const PORT = process.env.PORT || 5000;
prisma
  .$connect()
  .then(() => console.log("✅ DB connected"))
  .catch((e) => console.error("❌ DB connection failed:", e));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
