import { rateLimit } from "express-rate-limit";

const message = {
  status: "error",

  message: "Terlalu banyak permintaan. Silakan coba lagi nanti.",
};

const skipInTest = () =>
  process.env.NODE_ENV === "test" || process.env.VITEST === "true";

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,

  limit: 5,

  standardHeaders: "draft-8",

  legacyHeaders: false,

  message,

  skip: skipInTest,
});

export const resendVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 3,

  standardHeaders: "draft-8",

  legacyHeaders: false,

  message,

  skip: skipInTest,
});

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 5,

  skipSuccessfulRequests: true,

  standardHeaders: "draft-8",

  legacyHeaders: false,

  message,

  skip: skipInTest,
});

export const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 5,

  standardHeaders: "draft-8",

  legacyHeaders: false,

  message,

  skip: skipInTest,
});

export const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 10,

  standardHeaders: "draft-8",

  legacyHeaders: false,

  message,

  skip: skipInTest,
});

/**
 * Cart rate limiting.
 *
 * Endpoint ini memerlukan autentikasi, sehingga limit dihitung
 * berdasarkan userId, bukan IP bersama yang mungkin digunakan
 * beberapa user dalam satu jaringan.
 *
 * Secara default, limiter dilewati pada environment test.
 * TEST_CART_RATE_LIMIT=true mengaktifkannya khusus untuk integration test.
 */
const skipCartLimiterInTest = () => {
  if (process.env.TEST_CART_RATE_LIMIT === "true") {
    return false;
  }

  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
};

const cartRateLimitHandler = (
  _req: import("express").Request,
  res: import("express").Response,
) => {
  res.status(429).json({
    status: "error",
    code: "RATE_LIMIT_EXCEEDED",
    message: "Too many requests. Please try again later.",
  });
};

export const cartAddLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,

  keyGenerator: (req) => req.auth?.userId ?? "unauthenticated",

  standardHeaders: "draft-8",
  legacyHeaders: false,

  handler: cartRateLimitHandler,
  skip: skipCartLimiterInTest,
});

export const cartCheckoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,

  keyGenerator: (req) => req.auth?.userId ?? "unauthenticated",

  standardHeaders: "draft-8",
  legacyHeaders: false,

  handler: cartRateLimitHandler,
  skip: skipCartLimiterInTest,
});
