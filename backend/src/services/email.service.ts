import { Resend } from "resend";
import VerifyEmail from "../emails/verify-email";

const resend = new Resend(process.env.RESEND_API_KEY);

export interface sendEmailInput {
  email: string;
  token: string;
}

interface SendPasswordResetEmailInput {
  email: string;
  token: string;
}

export const sendEmail = async ({
  email,
  token,
}: sendEmailInput): Promise<void> => {
  const verificationUrl = new URL("/verify-email", process.env.FRONTEND_URL);
  verificationUrl.searchParams.set("token", token);

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: email,
    subject: "Verifikasi email lo - calle",
    react: VerifyEmail({ verifyUrl: verificationUrl.toString() }),
  });

  if (error) {
    // Jangan log token, tapi boleh log error dari provider
    console.error("Resend failed to send verification email", { email, error });
    throw new Error("Failed to send verification email");
  }
};

export const sendPasswordResetEmail = async ({
  email,
  token,
}: SendPasswordResetEmailInput): Promise<void> => {
  const resetUrl = new URL("/reset-password", process.env.FRONTEND_URL);

  resetUrl.searchParams.set("token", token);

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: email,
    subject: "Reset Password - calle",
    react: VerifyEmail({ verifyUrl: resetUrl.toString() }),
  });

  if (error) {
    // Jangan log token, tapi boleh log error dari provider
    console.error("Resend failed to send reset password", { email, error });
    throw new Error("Failed to send verification email");
  }
};
