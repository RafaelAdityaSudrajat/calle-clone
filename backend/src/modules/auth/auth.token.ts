import crypto from "crypto";
import jwt, { JwtPayload } from "jsonwebtoken";

import { Role } from "../../generated/prisma";
import { env } from "../../config/env";
import { hashToken } from "./auth.utils";

export const ACCESS_TOKEN_TTL_SECONDS =
  15 * 60;

export const REFRESH_TOKEN_TTL_MS =
  7 * 24 * 60 * 60 * 1000;

interface CreateAccessTokenInput {
  userId: string;
  role: Role;
}

export interface AccessTokenPayload
  extends JwtPayload {
  sub: string;
  role: Role;
}


export const createAccessToken = ({
  userId,
  role,
}: CreateAccessTokenInput): string => {
  return jwt.sign(
    {
      role,
    },
    env.JWT_ACCESS_SECRET,
    {
      algorithm: "HS256",

      subject: userId,

      expiresIn:
        ACCESS_TOKEN_TTL_SECONDS,

      issuer: env.JWT_ISSUER,

      audience: env.JWT_AUDIENCE,
    },
  );
};

export const verifyAccessToken = (
  token: string,
): AccessTokenPayload => {
  const payload = jwt.verify(
    token,
    env.JWT_ACCESS_SECRET,
    {
      algorithms: ["HS256"],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    },
  );

  if (
    typeof payload === "string" ||
    typeof payload.sub !== "string"
  ) {
    throw new Error(
      "Invalid access token payload",
    );
  }

  if (
    payload.role !== Role.BUYER &&
    payload.role !== Role.ADMIN
  ) {
    throw new Error(
      "Invalid access token role",
    );
  }

  return payload as AccessTokenPayload;
};

export const createRefreshToken = () => {
  const rawToken = crypto
    .randomBytes(64)
    .toString("base64url");

  const tokenHash =
    hashToken(rawToken);

  const expiresAt = new Date(
    Date.now() +
      REFRESH_TOKEN_TTL_MS,
  );

  return {
    rawToken,
    tokenHash,
    expiresAt,
  };
};