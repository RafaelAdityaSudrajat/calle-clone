export interface SendVerificationEmailInput {
  email: string;
  token: string;
}

export const sendVerificationEmail = async ({
  email,
  token,
}: SendVerificationEmailInput): Promise<void> => {
  const verificationUrl = new URL(
    "/verify-email",
    process.env.FRONTEND_URL,
  );

  verificationUrl.searchParams.set("token", token);

  /*
   * Integrasikan dengan email provider:
   *
   * - Resend
   * - AWS SES
   * - Postmark
   * - SendGrid
   * - SMTP / Nodemailer
   *
   * Jangan pernah log `token`.
   */

  console.log(
    `Send verification email to ${email}: ${verificationUrl.toString()}`,
  );
};