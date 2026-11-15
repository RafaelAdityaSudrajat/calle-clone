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
  .min(8, "Password minimal 8 karakter")
  .max(72, "Password terlalu panjang")
  .regex(/[A-Za-z]/, "Password harus mengandung minimal satu huruf")
  .regex(/[0-9]/, "Password harus mengandung minimal satu angka");
// ─── Register Schema ──────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

// ─── Types ────────────────────────────────────────────────────────────────────

/** Gunakan di useForm<RegisterInput> — before parse */
export type RegisterInput = z.input<typeof registerSchema>;
