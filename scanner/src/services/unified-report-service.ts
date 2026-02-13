import fs from "node:fs";
import path from "node:path";
import type {
  UnifiedReport,
  HttpReportData,
  HttpSummaryData,
  ScanTypeId,
} from "@penetragent/shared";
import { detectTechnologies } from "../scanTypes/detect-technology.js";

export interface UnifiedReportBuilder {
  addHttpScan(report: HttpReportData, summary: HttpSummaryData): void;
  build(): UnifiedReport;
  write(reportsDir: string): void;
}

export function createUnifiedReport(
  jobId: string,
  targetUrl: string,
): UnifiedReportBuilder {
  const scanTypes: ScanTypeId[] = [];
  const scans: UnifiedReport["scans"] = {};
  const summary: UnifiedReport["summary"] = {};
  const criticalFindings: string[] = [];
  let builtReport: UnifiedReport | null = null;

  return {
    addHttpScan(report: HttpReportData, summaryData: HttpSummaryData) {
      scanTypes.push("http");
      scans.http = report;
      summary.http = summaryData;
      criticalFindings.push(...summaryData.criticalFindings);
    },

    build(): UnifiedReport {
      if (builtReport) return builtReport;

      const httpData = scans.http;
      const detectedTechnologies = httpData
        ? detectTechnologies({
            urls: httpData.pages.map((p) => p.url),
            headers: httpData.pages.flatMap((p) => p.infoLeakage),
            metaGeneratorValues: httpData.metaGenerators,
          })
        : [];

      builtReport = {
        jobId,
        targetUrl,
        scanTypes,
        timestamp: new Date().toISOString(),
        scans,
        summary,
        detectedTechnologies,
        criticalFindings: [...new Set(criticalFindings)],
      };
      return builtReport;
    },

    write(reportsDir: string) {
      const report = this.build();
      const jobDir = path.join(reportsDir, jobId);
      fs.mkdirSync(jobDir, { recursive: true });
      fs.writeFileSync(
        path.join(jobDir, "report.json"),
        JSON.stringify(report, null, 2),
      );
    },
  };
}

export function loadUnifiedReport(
  reportsDir: string,
  jobId: string,
): UnifiedReport | null {
  const reportPath = path.join(reportsDir, jobId, "report.json");
  try {
    const data = fs.readFileSync(reportPath, "utf-8");
    return JSON.parse(data) as UnifiedReport;
  } catch {
    return null;
  }
}
