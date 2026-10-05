import { Request, Response, NextFunction } from "express";
import { ZodObject, ZodError } from "zod";

export const validate =
  (schema: ZodObject) => (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
        headers: req.headers,
      });

      // Assign hasil parse (termasuk hasil transform) kembali ke req
      if (parsed.body !== undefined) req.body = parsed.body;
      if (parsed.params !== undefined) req.params = parsed.params;
      // query di Express 5 read-only, jadi simpan terpisah kalau perlu
      if (parsed.query !== undefined)
        (req as any).validatedQuery = parsed.query;
      if (parsed.headers !== undefined)
        (req as any).validatedHeaders = parsed.headers;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: "Validasi input gagal",
          errors: error.issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
