import { z } from "zod";

// ─── Constants ────────────────────────────────────────────────────────────────

const PASSWORD_MIN_LENGTH = 8;



// ─── Base Field Schemas ───────────────────────────────────────────────────────

const fullNameSchema = z
  .string()
  .min(2, "Nama minimal 2 karakter.")
  .max(100, "Nama maksimal 100 karakter.")
  .trim();

const emailSchema = z
  .string()
  .email("Format email tidak valid.")
  .max(254, "Email terlalu panjang.")
  .toLowerCase()
  .trim();

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password minimal ${PASSWORD_MIN_LENGTH} karakter.`)
  .max(128, "Password terlalu panjang.");
// ─── Register Schema ──────────────────────────────────────────────────────────

export const registerSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi password tidak cocok.",
    path: ["confirmPassword"],
  })
  // .transform(({ confirmPassword: _, ...rest }) => rest); // buang confirmPassword

// ─── Types ────────────────────────────────────────────────────────────────────

/** Gunakan di useForm<RegisterInput> — before parse */
export type RegisterInput = z.input<typeof registerSchema>;

/** Gunakan di submit handler / API call — after parse */
export type RegisterOutput = z.output<typeof registerSchema>;
