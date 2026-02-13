/**
 * Unified Report Types
 *
 * This defines the structure for the consolidated report.json file that
 * serves as the source of truth for all scan data. HTML reports and other
 * formats are generated from this unified JSON structure.
 */

import type { ScanTypeId } from "./types.js";

export interface HeaderGrade {
  header: string;
  value: string | null;
  grade: "good" | "weak" | "missing";
  reason: string;
}

export interface DetectedTechnology {
  name: string;
  confidence: "high" | "medium" | "low";
  source: string;
}

export interface PageData {
  url: string;
  statusCode: number;
  contentType: string | null;
  headerGrades: HeaderGrade[];
  infoLeakage: { header: string; value: string }[];
  contentIssues: string[];
}

export interface HttpReportData {
  startUrl: string;
  pagesScanned: number;
  pages: PageData[];
  findings: string[];
  redirectChain: string[];
  metaGenerators: string[];
  timestamp: string;
}

export interface HttpSummaryData {
  pagesScanned: number;
  issuesFound: number;
  good: number;
  weak: number;
  missing: number;
  criticalFindings: string[];
}

/**
 * Unified Report Structure
 *
 * This is the single source of truth written to report.json.
 * Contains metadata plus scan-specific data sections.
 */
export interface UnifiedReport {
  jobId: string;
  targetUrl: string;
  scanTypes: ScanTypeId[];
  timestamp: string;

  scans: {
    http?: HttpReportData;
  };

  summary: {
    http?: HttpSummaryData;
  };

  detectedTechnologies: DetectedTechnology[];
  criticalFindings: string[];
}
