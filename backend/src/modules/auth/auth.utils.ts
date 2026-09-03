import crypto from "crypto";

import type { Request } from "express";

const TOKEN_BYTES = 32;

const EMAIL_VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000;

const RESET_PASSWORD_EXPIRY_MS = 30 * 60 * 1000;

export const generateSecureToken = (): string => {
  return crypto.randomBytes(TOKEN_BYTES).toString("hex");
};

export const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

export const createEmailVerificationToken = () => {
  const token = generateSecureToken();

  return {
    token,

    tokenHash: hashToken(token),

    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_MS),
  };
};

export const createResetPasswordToken = () => {
  const token = generateSecureToken();

  return {
    token,

    tokenHash: hashToken(token),

    expiresAt: new Date(Date.now() + RESET_PASSWORD_EXPIRY_MS),
  };
};

export const getAuditRequestContext = (req: Request) => {
  return {
    ipAddress: req.ip ?? null,

    userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
  };
};
