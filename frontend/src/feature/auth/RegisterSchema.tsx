import { z } from "zod";

// ─── Constants ────────────────────────────────────────────────────────────────

const PASSWORD_MIN_LENGTH = 8;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 32;

/**
 * PASSWORD_REGEX : min 1 uppercase, 1 lowercase, 1 digit, 1 special char
 * USERNAME_REGEX : alphanumeric + underscore/dash only → prevent XSS via username
 */
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).+$/;

const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;

// ─── Base Field Schemas ───────────────────────────────────────────────────────

const fullNameSchema = z
  .string()
  .min(USERNAME_MIN_LENGTH, `Username minimal ${USERNAME_MIN_LENGTH} karakter.`)
  .max(USERNAME_MAX_LENGTH, `Username maksimal ${USERNAME_MAX_LENGTH} karakter.`)
  .regex(USERNAME_REGEX, "Username hanya boleh huruf, angka, underscore, dan dash.")
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
  .max(128, "Password terlalu panjang.")
  .regex(
    PASSWORD_REGEX,
    "Password harus mengandung huruf besar, kecil, angka, dan karakter spesial."
  );
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
  });

// ─── Types ────────────────────────────────────────────────────────────────────

/** Gunakan di useForm<RegisterInput> — before parse */
export type RegisterInput = z.input<typeof registerSchema>;

/** Gunakan di submit handler / API call — after parse */
export type RegisterOutput = z.output<typeof registerSchema>;
