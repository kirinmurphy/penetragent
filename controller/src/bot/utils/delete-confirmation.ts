import { DELETION_TYPE } from "../constants.js";

interface PendingDeletion {
  identifier: string;
  type: typeof DELETION_TYPE[keyof typeof DELETION_TYPE];
  count: number;
  expires: Date;
}

export function createDeleteConfirmationManager() {
  const pending = new Map<number, PendingDeletion>();

  return {
    setPending(chatId: number, deletion: Omit<PendingDeletion, "expires">): void {
      pending.set(chatId, {
        ...deletion,
        expires: new Date(Date.now() + 60000), // 60 seconds
      });
    },

    getPending(chatId: number): PendingDeletion | undefined {
      const deletion = pending.get(chatId);
      if (!deletion) return undefined;

      if (new Date() > deletion.expires) {
        pending.delete(chatId);
        return undefined;
      }

      return deletion;
    },

    clearPending(chatId: number): void {
      pending.delete(chatId);
    },

    cleanupExpired(): void {
      const now = new Date();
      for (const [chatId, deletion] of pending.entries()) {
        if (now > deletion.expires) {
          pending.delete(chatId);
        }
      }
    },
  };
}

export type DeleteConfirmationManager = ReturnType<typeof createDeleteConfirmationManager>;
