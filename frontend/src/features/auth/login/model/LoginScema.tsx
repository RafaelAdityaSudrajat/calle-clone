import { z } from "zod";

// ─── Base Field Schemas ───────────────────────────────────────────────────────

const emailSchema = z
  .string()
  .trim()
  .max(254, "Email terlalu panjang")
  .email("Format email tidak valid")
  .transform((email) => email.toLowerCase());

const passwordSchema = z
  .string()
  .min(1, "Password saat ini wajib diisi")
  .max(72, "Password terlalu panjang");
// ─── Log in Schema ──────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

// ─── Types ────────────────────────────────────────────────────────────────────

/** Gunakan di useForm<RegisterInput> — before parse */
export type LoginInput = z.input<typeof loginSchema>;
export type LoginOutput = z.output<typeof loginSchema>;
