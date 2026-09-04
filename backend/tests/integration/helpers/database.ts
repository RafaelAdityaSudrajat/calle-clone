import { prisma } from "../../../src/lib/prisma";

export const cleanAuthDatabase = async (): Promise<void> => {
  /*
   * Urutan penting karena foreign key.
   */

  await prisma.auditLog.deleteMany();

  await prisma.refreshToken.deleteMany();

  await prisma.user.deleteMany();
};
