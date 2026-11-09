import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): Response {
  if (err instanceof AppError) {
    // ── Multi-error: `details` adalah array non-empty ───────────
    // Publish & validasi multi-failure masuk sini.
    // `Array.isArray` mempersempit tipe `Record | ErrorDetail[]`
    // ke `ErrorDetail[]` sehingga `.length` valid & payload-nya
    // terkirim sebagai `data.errors[]`.
    if (Array.isArray(err.details) && err.details.length > 0) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        data: { errors: err.details },
      });
    }

    // ── Single-error (existing, tidak berubah) ──────────────────
    // `details` object (mis. cart price_changes) atau undefined:
    // format tetap seperti sebelumnya. Kalau object, sertakan
    // sebagai `data` — perilaku yang sudah dipakai cart.
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
      ...(err.details && !Array.isArray(err.details)
        ? { data: err.details }
        : {}),
    });
  }

  // ── Non-AppError (ZodError, PrismaError, dsb.) ─────────────
  // Sesuaikan dengan mapping existing-mu. Yang WAJIB: setiap
  // branch return, dan ada fallback 500 di akhir supaya TS
  // tidak komplain "lacks ending return".

  // Contoh — ganti dengan handling existing:
  // if (err instanceof ZodError) { return res.status(400)...; }
  // if (err instanceof Prisma.PrismaClientKnownRequestError) { ... return ...; }

  return res.status(500).json({
    success: false,
    code: "INTERNAL_ERROR",
    message: "Internal server error",
  });
}
