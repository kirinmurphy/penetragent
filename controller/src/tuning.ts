export const TUNING = {
  telegram: {
    messageCharLimit: 4000,
    captionCharLimit: 1024,
  },

  polling: {
    reportFetchTimeoutMs: 30_000,
    maxJobsToRecover: 100,
  },

  history: {
    maxJobsLimit: 1000,
    defaultRecentLimit: 100,
    groupDisplayLimit: 10,
  },

  confirmationCleanupIntervalMs: 5 * 60 * 1000,
} as const;
