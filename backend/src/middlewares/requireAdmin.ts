// src/middlewares/requireAdmin.ts
import { Request, Response, NextFunction } from "express";
import { Role } from "../generated/prisma";
import { ForbiddenError, UnauthorizedError } from "../lib/errors";

export const requireAdmin = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  if (!req.auth) return next(new UnauthorizedError());
  if (req.auth.role !== Role.ADMIN) return next(new ForbiddenError());
  next();
};
