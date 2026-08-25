import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password minimal 8 karakter")
  .max(72, "Password terlalu panjang")
  .regex(/[A-Za-z]/, "Password harus mengandung minimal satu huruf")
  .regex(/[0-9]/, "Password harus mengandung minimal satu angka");

export const registerBuyerBodySchema = z
  .object({
    email: z
      .string()
      .trim()
      .max(254, "Email terlalu panjang")
      .email("Format email tidak valid")
      .transform((email) => email.toLowerCase()),

    password: passwordSchema,
  })
  .strict();

export const verifyEmailBodySchema = z
  .object({
    token: z
      .string()
      .length(64, "Token verifikasi tidak valid")
      .regex(/^[a-f0-9]+$/i, "Token verifikasi tidak valid"),
  })
  .strict();

export const loginBodySchema = z
  .object({
    email: z
      .string()
      .trim()
      .max(254, "Email terlalu panjang")
      .email("Format email tidak valid")
      .transform((email) => email.toLowerCase()),

    password: z
      .string()
      .min(1, "Password wajib diisi")
      .max(72, "Password terlalu panjang"),
  })
  .strict();

export const forgotPasswordBodySchema = z
  .object({
    email: z
      .string()
      .trim()
      .max(254, "Email terlalu panjang")
      .email("Format email tidak valid")
      .transform((email) => email.toLowerCase()),
  })
  .strict();

export const resetPasswordBodySchema = z
  .object({
    token: z
      .string()
      .length(64, "Token reset password tidak valid")
      .regex(/^[a-f0-9]+$/i, "Token reset password tidak valid"),

    newPassword: passwordSchema,
  })
  .strict();

export const verifyEmailSchema = z.object({
  body: verifyEmailBodySchema,
});

export const registerBuyerSchema = z.object({
  body: registerBuyerBodySchema,
});

export const loginSchema = z.object({
  body: loginBodySchema,
});

export const forgotPasswordSchema = z.object({
  body: forgotPasswordBodySchema,
});

export const resetPasswordSchema = z.object({
  body: resetPasswordBodySchema,
});

export type RegisterBuyerInput = z.infer<typeof registerBuyerBodySchema>;

export type VerifyEmailInput = z.infer<typeof verifyEmailBodySchema>;

export type LoginInput = z.infer<typeof loginBodySchema>;

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>["body"];

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>["body"];
