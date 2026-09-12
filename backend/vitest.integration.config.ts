import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

dotenv.config({
  path: ".env.test",
  override: true,
});

export default defineConfig({
  test: {
    environment: "node",

    include: ["tests/integration/**/*.test.ts"],

    /*
     * Untuk sekarang test menggunakan
     * satu database bersama.
     *
     * Jalankan test files secara serial
     * agar cleanup antar file tidak bentrok.
     */
    fileParallelism: false,

    clearMocks: true,

    testTimeout: 15_000,

    env: {
      NODE_ENV: "test",
    },
  },
});
