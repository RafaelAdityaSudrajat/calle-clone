// src/lib/email.ts
import { Resend } from 'resend';
import VerifyEmail from '../emails/verify-email';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(to: string, token: string) {
  const verifyUrl = `${process.env.FRONTEND_URL}verify-email?token=${token}`;

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject: 'Verifikasi email lo - calle',
    react: VerifyEmail({ verifyUrl }),
  });

  if (error) {
    console.error('Failed to send verification email:', error);
    throw new Error('Failed to send verification email');
  }

  return data;
}