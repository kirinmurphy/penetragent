import type { JobPublic, JobListResponse } from "@penetragent/shared";

export interface TargetInfo {
  id: string;
  base_url: string;
  description: string | null;
}

export class ScannerUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScannerUnavailableError";
  }
}

export class RateLimitedError extends Error {
  public readonly runningJobId: string;
  constructor(runningJobId: string) {
    super("A scan is already running");
    this.name = "RateLimitedError";
    this.runningJobId = runningJobId;
  }
}

export class ScannerApiError extends Error {
  public readonly statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "ScannerApiError";
    this.statusCode = statusCode;
  }
}

export class ScannerClient {
  constructor(private readonly baseUrl: string) {}

  async health(): Promise<{ ok: boolean }> {
    const res = await this.fetch("/health");
    return res.json() as Promise<{ ok: boolean }>;
  }

  async listTargets(): Promise<TargetInfo[]> {
    const res = await this.fetch("/targets");
    if (!res.ok) {
      throw new ScannerApiError(res.status, await res.text());
    }
    const body = (await res.json()) as { targets: TargetInfo[] };
    return body.targets;
  }

  async createScan(
    target: string,
    requestedBy: string,
    scanType?: string,
  ): Promise<JobPublic> {
    const isUrl = target.startsWith("http://") || target.startsWith("https://");
    const body: Record<string, string> = isUrl
      ? { url: target, requestedBy }
      : { targetId: target, requestedBy };
    if (scanType) {
      body.scanType = scanType;
    }
    const res = await this.fetch("/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      const body = (await res.json()) as { runningJobId: string };
      throw new RateLimitedError(body.runningJobId);
    }

    if (!res.ok) {
      const body = await res.text();
      throw new ScannerApiError(res.status, body);
    }

    return res.json() as Promise<JobPublic>;
  }

  async getJob(jobId: string): Promise<JobPublic> {
    const res = await this.fetch(`/jobs/${jobId}`);
    if (!res.ok) {
      throw new ScannerApiError(res.status, await res.text());
    }
    return res.json() as Promise<JobPublic>;
  }

  async listJobs(
    opts: { limit?: number; offset?: number; status?: string } = {},
  ): Promise<JobListResponse> {
    const { limit = 10, offset = 0, status } = opts;
    let url = `/jobs?limit=${limit}&offset=${offset}`;
    if (status) {
      url += `&status=${encodeURIComponent(status)}`;
    }
    const res = await this.fetch(url);
    if (!res.ok) {
      throw new ScannerApiError(res.status, await res.text());
    }
    return res.json() as Promise<JobListResponse>;
  }

  async listJobsByTarget(
    opts: { targetId: string; limit?: number; offset?: number },
  ): Promise<JobListResponse> {
    const { targetId, limit = 100, offset = 0 } = opts;
    const url = `/jobs?targetId=${encodeURIComponent(targetId)}&limit=${limit}&offset=${offset}`;
    const res = await this.fetch(url);
    if (!res.ok) {
      throw new ScannerApiError(res.status, await res.text());
    }
    return res.json() as Promise<JobListResponse>;
  }

  async deleteJob(jobId: string): Promise<{ deleted: number }> {
    const res = await this.fetch(`/jobs/${jobId}`, { method: "DELETE" });
    if (!res.ok) {
      throw new ScannerApiError(res.status, await res.text());
    }
    return res.json() as Promise<{ deleted: number }>;
  }

  async deleteJobsByTarget(targetId: string): Promise<{ deleted: number }> {
    const res = await this.fetch(
      `/jobs?targetId=${encodeURIComponent(targetId)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      throw new ScannerApiError(res.status, await res.text());
    }
    return res.json() as Promise<{ deleted: number }>;
  }

  async deleteAllJobs(): Promise<{ deleted: number }> {
    const res = await this.fetch("/jobs/all", { method: "DELETE" });
    if (!res.ok) {
      throw new ScannerApiError(res.status, await res.text());
    }
    return res.json() as Promise<{ deleted: number }>;
  }

  private async fetch(
    path: string,
    init?: RequestInit,
  ): Promise<Response> {
    try {
      return await globalThis.fetch(`${this.baseUrl}${path}`, init);
    } catch (err) {
      throw new ScannerUnavailableError(
        `Scanner at ${this.baseUrl} is unavailable: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
