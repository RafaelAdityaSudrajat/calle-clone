import { z } from "zod";

// Envelope standar backend: { success, message, data }
export const apiResponseSchema = <T extends z.ZodType>(data: T) =>
  z.object({
    success: z.literal(true),
    message: z.string(),
    data,
  });
