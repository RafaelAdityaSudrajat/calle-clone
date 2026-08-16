import { prisma } from "../../lib/prisma";

const MAX_FAILED_LOGIN_ATTEMPTS = 5;

const LOGIN_WINDOW_MS =
  15 * 60 * 1000;

const ACCOUNT_LOCK_DURATION_MS =
  15 * 60 * 1000;

export const recordFailedLoginAttempt =
  async (userId: string) => {
    const now = new Date();

    return prisma.$transaction(
      async (tx) => {
        const user =
          await tx.user.findUnique({
            where: {
              id: userId,
            },

            select: {
              failedLoginAttempts: true,
              failedLoginWindowStart:
                true,
            },
          });

        if (!user) {
          return {
            locked: false,
            lockoutUntil: null,
          };
        }

        const windowExpired =
          !user.failedLoginWindowStart ||
          now.getTime() -
            user.failedLoginWindowStart.getTime() >=
            LOGIN_WINDOW_MS;

        const nextAttempts =
          windowExpired
            ? 1
            : user.failedLoginAttempts +
              1;

        /*
         * Belum mencapai limit.
         */
        if (
          nextAttempts <
          MAX_FAILED_LOGIN_ATTEMPTS
        ) {
          await tx.user.update({
            where: {
              id: userId,
            },

            data: {
              failedLoginAttempts:
                nextAttempts,

              failedLoginWindowStart:
                windowExpired
                  ? now
                  : user.failedLoginWindowStart,

              /*
               * Bersihkan old lock yang
               * sudah expired.
               */
              lockoutUntil: null,
            },
          });

          return {
            locked: false,
            lockoutUntil: null,
          };
        }

        /*
         * Percobaan ke-5 dalam window.
         */
        const lockoutUntil =
          new Date(
            now.getTime() +
              ACCOUNT_LOCK_DURATION_MS,
          );

        await tx.user.update({
          where: {
            id: userId,
          },

          data: {
            lockoutUntil,

            /*
             * Counter di-reset karena akun
             * sudah masuk state LOCKED.
             */
            failedLoginAttempts: 0,

            failedLoginWindowStart: null,
          },
        });

        return {
          locked: true,
          lockoutUntil,
        };
      },
    );
  };