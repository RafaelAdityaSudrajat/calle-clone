import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

dotenv.config({
  path: ".env.test",
  override: true,
});

export default defineConfig({
  test: {
    environment: "node",

    include: ["tests/unit-test/**/*.test.ts", "tests/integration/**/*.test.ts"],

    // Database digunakan bersama.
    // Jalankan setiap test file secara serial.
    fileParallelism: false,

    clearMocks: true,

    testTimeout: 15_000,

    env: {
      NODE_ENV: "test",
    },
  },
});
