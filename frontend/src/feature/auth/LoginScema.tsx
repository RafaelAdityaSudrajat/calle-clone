import { z } from "zod";

// ─── Base Field Schemas ───────────────────────────────────────────────────────

const emailSchema = z
  .string()
  .email("Format email tidak valid.")
  .max(254, "Email terlalu panjang.")
  .toLowerCase()
  .trim();

const passwordSchema = z
  .string()
  .min(1, "Password wajib diisi.")
  .max(128, "Password terlalu panjang.");
// ─── Log in Schema ──────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

// ─── Types ────────────────────────────────────────────────────────────────────

/** Gunakan di useForm<RegisterInput> — before parse */
export type LoginInput = z.input<typeof loginSchema>;
export type LoginOutput = z.output<typeof loginSchema>;
