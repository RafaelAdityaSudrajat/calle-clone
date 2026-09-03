import { AuditEvent, type Prisma } from "../../generated/prisma";

import { prisma } from "../../lib/prisma";

type AuditDatabase = typeof prisma | Prisma.TransactionClient;

interface RecordAuditEventInput {
  event: AuditEvent;

  actorUserId?: string | null;
  targetUserId?: string | null;

  ipAddress?: string | null;
  userAgent?: string | null;
}

export const recordAuditEvent = async (
  {
    event,
    actorUserId,
    targetUserId,
    ipAddress,
    userAgent,
  }: RecordAuditEventInput,

  db: AuditDatabase = prisma,
): Promise<void> => {
  await db.auditLog.create({
    data: {
      event,

      actorUserId: actorUserId ?? null,

      targetUserId: targetUserId ?? null,

      ipAddress: ipAddress ?? null,

      userAgent: userAgent ?? null,
    },
  });
};

export const recordAuditEventBestEffort = async (
  input: RecordAuditEventInput,
): Promise<void> => {
  try {
    await recordAuditEvent(input);
  } catch (error) {
    /*
     * Production:
     * ganti dengan Pino/Winston/Sentry.
     *
     * Jangan log password/token.
     */
    console.error("Failed to persist audit event", {
      event: input.event,
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId,
    });
  }
};
