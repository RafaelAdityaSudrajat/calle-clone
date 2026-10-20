import { Request, Response, NextFunction } from "express";
import { ZodType, ZodError } from "zod";
import { ValidationError } from "../lib/errors";

type RequestSchema = {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
  headers?: ZodType;
};

export const validate =
  (schema: RequestSchema) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }
      if (schema.params) {
        req.params = schema.params.parse(req.params) as typeof req.params;
      }
      if (schema.query) {
        (req as any).validatedQuery = schema.query.parse(req.query);
      }
      if (schema.headers) {
        (req as any).validatedHeaders = schema.headers.parse(req.headers);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          new ValidationError("Validation failed", {
            errors: error.issues.map((issue) => ({
              field: issue.path.join("."),
              message: issue.message,
            })),
          }),
        );
        return;
      }
      next(error);
    }
  };
