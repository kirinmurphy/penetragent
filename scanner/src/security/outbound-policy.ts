import type { ScannerConfig } from "@penetragent/shared";
import { DnsError, verifyPublicOnly } from "./verify-public-only.js";

function hostnameMatchesPattern(hostname: string, pattern: string): boolean {
  if (!pattern) return false;
  const normalizedHost = hostname.toLowerCase();
  const normalizedPattern = pattern.toLowerCase();
  if (normalizedPattern.startsWith("*.")) {
    const suffix = normalizedPattern.slice(1);
    return normalizedHost.endsWith(suffix);
  }
  return normalizedHost === normalizedPattern;
}

function getUrlPort(url: URL): number {
  if (url.port) return parseInt(url.port, 10);
  return url.protocol === "https:" ? 443 : 80;
}

export interface OutboundPolicy {
  mode: ScannerConfig["scanPolicyMode"];
  verifyUrl(url: URL): Promise<void>;
  verifyHostname(hostname: string): Promise<void>;
  getResolvedIps(hostname: string): string[] | null;
}

export function createOutboundPolicy(config: {
  scannerConfig: ScannerConfig;
  targetUrl: string;
  jobId?: string;
}): OutboundPolicy {
  const { scannerConfig, targetUrl, jobId } = config;
  const target = new URL(targetUrl);
  const targetHostname = target.hostname.toLowerCase();
  const verifiedIpsByHost = new Map<string, string[] | null>();
  const mode: ScannerConfig["scanPolicyMode"] =
    scannerConfig.scanPolicyMode === "internal-assessment" &&
    scannerConfig.internalAssessmentDisabled
      ? "external-safe"
      : scannerConfig.scanPolicyMode;

  const internalAllowedHostPatterns = new Set<string>([
    targetHostname,
    ...scannerConfig.internalAllowedHostPatterns.map((h) => h.toLowerCase()),
  ]);
  const internalAllowedPorts = new Set(scannerConfig.internalAllowedPorts);

  function emitAuditLog(event: {
    url?: string;
    host: string;
    port: number | null;
    allowed: boolean;
    reason: string;
    dnsCheck?: "passed" | "skipped" | "failed";
    resolvedIps?: string[] | null;
    cachedResolution?: boolean;
  }): void {
    if (!event.allowed || scannerConfig.outboundAuditLogLevel === "all") {
      console.log(JSON.stringify({
        type: "outbound_audit",
        timestamp: new Date().toISOString(),
        jobId: jobId ?? null,
        mode,
        targetUrl,
        ...event,
      }));
    }
  }

  if (
    scannerConfig.scanPolicyMode === "internal-assessment" &&
    scannerConfig.internalAssessmentDisabled
  ) {
    emitAuditLog({
      host: targetHostname,
      port: getUrlPort(target),
      allowed: true,
      reason: "internal-assessment disabled by kill switch; downgraded to external-safe mode",
      dnsCheck: "skipped",
      resolvedIps: null,
      cachedResolution: true,
    });
  }

  function assertHostnameAllowed(hostname: string): void {
    const normalizedHost = hostname.toLowerCase();
    if (mode === "external-safe") {
      if (normalizedHost !== targetHostname) {
        throw new Error(`Disallowed outbound host: ${hostname}`);
      }
      return;
    }

    const allowed = Array.from(internalAllowedHostPatterns).some((pattern) =>
      hostnameMatchesPattern(normalizedHost, pattern)
    );
    if (!allowed) {
      throw new Error(`Host ${hostname} is outside internal assessment allowlist`);
    }
  }

  function assertPortAllowed(url: URL): void {
    if (mode !== "internal-assessment") return;
    const port = getUrlPort(url);
    if (!internalAllowedPorts.has(port)) {
      throw new Error(`Port ${port} is outside internal assessment allowlist`);
    }
  }

  async function verifyHostname(hostname: string): Promise<void> {
    assertHostnameAllowed(hostname);

    const normalizedHost = hostname.toLowerCase();
    if (verifiedIpsByHost.has(normalizedHost)) {
      return;
    }

    if (
      mode === "internal-assessment" &&
      scannerConfig.internalAllowPrivateIps
    ) {
      verifiedIpsByHost.set(normalizedHost, null);
      return;
    }

    const ips = await verifyPublicOnly(hostname);
    verifiedIpsByHost.set(normalizedHost, ips);
  }

  async function verifyUrl(url: URL): Promise<void> {
    const port = getUrlPort(url);
    try {
      if (scannerConfig.outboundEgressDisabled) {
        throw new Error("Outbound egress is disabled by emergency kill switch");
      }

      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error(`Unsupported outbound protocol: ${url.protocol}`);
      }

      const cachedResolution = verifiedIpsByHost.has(url.hostname.toLowerCase());
      assertPortAllowed(url);
      await verifyHostname(url.hostname);
      const resolvedIps = getResolvedIps(url.hostname);
      emitAuditLog({
        url: url.href,
        host: url.hostname,
        port,
        allowed: true,
        reason: "allowed by outbound policy",
        dnsCheck: resolvedIps === null ? "skipped" : "passed",
        resolvedIps,
        cachedResolution,
      });
    } catch (err) {
      const reason = err instanceof DnsError
        ? `${err.code}: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);
      emitAuditLog({
        url: url.href,
        host: url.hostname,
        port,
        allowed: false,
        reason,
        dnsCheck: err instanceof DnsError ? "failed" : "skipped",
        resolvedIps: null,
        cachedResolution: verifiedIpsByHost.has(url.hostname.toLowerCase()),
      });
      throw err;
    }
  }

  function getResolvedIps(hostname: string): string[] | null {
    return verifiedIpsByHost.get(hostname.toLowerCase()) ?? null;
  }

  return { mode, verifyUrl, verifyHostname, getResolvedIps };
}

export { DnsError };
