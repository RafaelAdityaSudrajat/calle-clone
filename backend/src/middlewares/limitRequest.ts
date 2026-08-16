import { rateLimit } from "express-rate-limit";

const message = {
  status: "error",

  message: "Terlalu banyak permintaan. Silakan coba lagi nanti.",
};

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,

  limit: 5,

  standardHeaders: "draft-8",

  legacyHeaders: false,

  message,
});

export const resendVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 3,

  standardHeaders: "draft-8",

  legacyHeaders: false,

  message,
});

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 5,

  skipSuccessfulRequests: true,

  standardHeaders: "draft-8",

  legacyHeaders: false,

  message,
});
