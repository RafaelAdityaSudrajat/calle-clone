import { z } from "zod";

// ─── Base Field Schemas ───────────────────────────────────────────────────────

const emailSchema = z
  .string()
  .email("Format email tidak valid.")
  .max(254, "Email terlalu panjang.")
  .trim();

const passwordSchema = z
  .string()
  .min(8, "Password minimal 8 karakter")
  .regex(/[A-Za-z]/, "Password harus memiliki minimal 1 huruf")
  .regex(/[0-9]/, "Password harus memiliki minimal 1 angka");
// ─── Register Schema ──────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
// .transform(({ confirmPassword: _, ...rest }) => rest); // buang confirmPassword

// ─── Types ────────────────────────────────────────────────────────────────────

/** Gunakan di useForm<RegisterInput> — before parse */
export type RegisterInput = z.input<typeof registerSchema>;
