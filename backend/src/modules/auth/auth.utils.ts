import crypto from "crypto";

const EMAIL_VERIFICATION_TOKEN_BYTES = 32;

const EMAIL_VERIFICATION_EXPIRY_MS =
  24 * 60 * 60 * 1000;

export const generateSecureToken = (): string => {
  return crypto
    .randomBytes(EMAIL_VERIFICATION_TOKEN_BYTES)
    .toString("hex");
};

export const hashToken = (token: string): string => {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
};

export const createEmailVerificationToken = () => {
  const token = generateSecureToken();

  return {
    token,

    tokenHash: hashToken(token),

    expiresAt: new Date(
      Date.now() + EMAIL_VERIFICATION_EXPIRY_MS,
    ),
  };
};