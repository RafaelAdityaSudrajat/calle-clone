import {
  CookieOptions,
  Response,
} from "express";

import { env } from "../../config/env";

import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_MS,
} from "./auth.token";

const baseCookieOptions:
  CookieOptions = {
  httpOnly: true,

  /*
   * HTTPS only di production.
   */
  secure:
    env.NODE_ENV ===
    "production",

  sameSite: "strict",
};

export const accessTokenCookieOptions:
  CookieOptions = {
  ...baseCookieOptions,

  maxAge:
    ACCESS_TOKEN_TTL_SECONDS *
    1000,

  path: "/",
};

export const refreshTokenCookieOptions:
  CookieOptions = {
  ...baseCookieOptions,

  maxAge:
    REFRESH_TOKEN_TTL_MS,

  /*
   * Refresh token tidak perlu dikirim
   * ke endpoint product/cart/dll.
   */
  path: "/api/auth",
};

interface SetAuthCookiesInput {
  accessToken: string;
  refreshToken: string;
}

export const setAuthCookies = (
  res: Response,
  {
    accessToken,
    refreshToken,
  }: SetAuthCookiesInput,
): void => {
  res.cookie(
    "accessToken",
    accessToken,
    accessTokenCookieOptions,
  );

  res.cookie(
    "refreshToken",
    refreshToken,
    refreshTokenCookieOptions,
  );
};

export const clearAuthCookies = (
  res: Response,
): void => {
  /*
   * Path harus sama dengan path
   * ketika cookie dibuat.
   *
   * Jangan sertakan maxAge atau expires
   * saat clearCookie.
   */
  res.clearCookie("accessToken", {
    ...baseCookieOptions,
    path: "/",
  });

  res.clearCookie("refreshToken", {
    ...baseCookieOptions,
    path: "/api/auth",
  });
};