import type { AccountStatus, Role } from "../generated/prisma";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        role: Role;
        status: AccountStatus;
      };
      validatedParams?: unknown;
      validatedQuery?: unknown;
      validatedHeaders?: { idempotencyKey: string };
    }
  }
}

export {};
