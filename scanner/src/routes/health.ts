import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => {
    const requestedMode = app.config.scanPolicyMode;
    const effectiveMode =
      requestedMode === "internal-assessment" &&
      app.config.internalAssessmentDisabled
        ? "external-safe"
        : requestedMode;

    return {
      ok: true,
      policy: {
        requestedMode,
        effectiveMode,
        internalAssessmentDisabled: app.config.internalAssessmentDisabled,
        outboundEgressDisabled: app.config.outboundEgressDisabled,
      },
    };
  });
}
