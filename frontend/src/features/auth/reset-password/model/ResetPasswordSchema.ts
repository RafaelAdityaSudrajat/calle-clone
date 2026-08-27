import { z } from "zod";

// ─── Base Field Schemas ───────────────────────────────────────────────────────

const passwordSchema = z
  .string()
  .min(8, "Password minimal 8 karakter")
  .regex(/[A-Za-z]/, "Password harus memiliki minimal 1 huruf")
  .regex(/[0-9]/, "Password harus memiliki minimal 1 angka");

const confirmPasswordSchema = z
  .string()
  .min(1, "Konfirmasi password wajib diisi");

// ─── Form Schema ────────────────────────────────────────────────────

export const resetPasswordSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: confirmPasswordSchema,
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Konfirmasi password tidak sama",
    path: ["confirmPassword"],
  });

// ─── API Payload Schema ─────────────────────────────────────────────

export const resetPasswordPayloadSchema = z.object({
  newPassword: passwordSchema,

  token: z.string().min(1, "Token reset password wajib ada"),
});

// ─── Types ──────────────────────────────────────────────────────────

export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;

export type ResetPasswordPayload = z.infer<typeof resetPasswordPayloadSchema>;
