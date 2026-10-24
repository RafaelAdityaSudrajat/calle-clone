import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

dotenv.config({
  path: ".env.test",
  override: true,
});

export default defineConfig({
  test: {
    environment: "node",

    // Jalankan kedua suite dalam satu proses coverage.
    include: ["tests/unit-test/**/*.test.ts", "tests/integration/**/*.test.ts"],

    // Pertahankan keamanan test yang memakai database bersama.
    fileParallelism: false,

    clearMocks: true,
    testTimeout: 15_000,

    env: {
      NODE_ENV: "test",
    },

    coverage: {
      enabled: true,
      provider: "v8",

      // Ukur source backend, termasuk file yang belum teruji.
      include: ["src/**/*.ts"],

      exclude: [
        "src/generated/**",
        "src/**/*.d.ts",
        "src/**/*.types.ts",
        "src/**/types/**",
      ],

      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage/combined",

      thresholds: {
        // Baseline minimum untuk backend keseluruhan.
        statements: 60,
        lines: 60,

        // Jaga agar coverage modul Cart tidak turun drastis.
        "src/modules/cart/**": {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
      },
    },
  },
});
