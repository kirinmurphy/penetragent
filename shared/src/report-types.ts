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

export interface CookieIssue {
  name: string;
  url: string;
  issues: string[];
  raw: string;
}

export interface ScriptIssue {
  url: string;
  pageUrl: string;
  issues: string[];
  isExternal: boolean;
  hasSri: boolean;
  libraryMatch: string | null;
}

export interface CorsIssue {
  url: string;
  allowOrigin: string | null;
  allowCredentials: boolean;
  issues: string[];
}

export interface PageData {
  url: string;
  statusCode: number;
  contentType: string | null;
  headerGrades: HeaderGrade[];
  infoLeakage: { header: string; value: string }[];
  contentIssues: string[];
  totalCookiesScanned?: number;
  cookieIssues?: CookieIssue[];
  totalExternalScripts?: number;
  scriptIssues?: ScriptIssue[];
  corsChecked?: boolean;
  corsIssues?: CorsIssue[];
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

export interface TlsCertificateData {
  subject: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  daysUntilExpiry: number;
  isExpired: boolean;
  isSelfSigned: boolean;
  subjectAltNames: string[];
  hostnameMatch: boolean;
  serialNumber: string;
  fingerprint: string;
}

export interface TlsChainCertificate {
  subject: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  isSelfSigned: boolean;
}

export interface TlsProtocolSupport {
  protocol: string;
  supported: boolean;
  grade: "good" | "weak" | "missing";
  reason: string;
}

export interface TlsCipherInfo {
  name: string;
  standardName: string;
  version: string;
  grade: "good" | "weak" | "missing";
  reason: string;
  hasForwardSecrecy: boolean;
}

export interface TlsGrade {
  check: string;
  value: string;
  grade: "good" | "weak" | "missing";
  reason: string;
}

export interface TlsReportData {
  host: string;
  port: number;
  certificate: TlsCertificateData;
  chain: TlsChainCertificate[];
  protocols: TlsProtocolSupport[];
  cipher: TlsCipherInfo;
  grades: TlsGrade[];
  findings: string[];
  timestamp: string;
}

export interface TlsSummaryData {
  host: string;
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
    tls?: TlsReportData;
  };

  summary: {
    http?: HttpSummaryData;
    tls?: TlsSummaryData;
  };

  detectedTechnologies: DetectedTechnology[];
  criticalFindings: string[];
}
