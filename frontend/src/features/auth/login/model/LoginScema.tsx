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
  .min(8, "Password minimal 8 karakter")
  .regex(/[A-Za-z]/, "Password harus memiliki minimal 1 huruf")
  .regex(/[0-9]/, "Password harus memiliki minimal 1 angka");
// ─── Log in Schema ──────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

// ─── Types ────────────────────────────────────────────────────────────────────

/** Gunakan di useForm<RegisterInput> — before parse */
export type LoginInput = z.input<typeof loginSchema>;
export type LoginOutput = z.output<typeof loginSchema>;
