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

export const verifyEmailSchema = z.object({
  body: verifyEmailBodySchema,
});

export const registerBuyerSchema = z.object({
  body: registerBuyerBodySchema,
});

export type RegisterBuyerInput = z.infer<typeof registerBuyerBodySchema>;

export type VerifyEmailInput = z.infer<typeof verifyEmailBodySchema>;
