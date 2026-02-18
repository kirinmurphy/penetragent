import type { ScriptIssue } from "@penetragent/shared";
import { SCRIPT_ANALYSIS_CONFIG } from "../../config/scan-rules.js";

const SCRIPT_TAG_PATTERN = /<script\b([^>]*)(?:\/>|>([\s\S]*?)<\/script>)/gi;
const SRC_ATTR_PATTERN = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const INTEGRITY_ATTR_PATTERN = /\bintegrity\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

function isExternalUrl(src: string): boolean {
  return src.startsWith("http://") || src.startsWith("https://") || src.startsWith("//");
}

function findVulnerableLibrary(src: string): string | null {
  for (const { pattern, label } of SCRIPT_ANALYSIS_CONFIG.vulnerablePatterns) {
    if (pattern.test(src)) return label;
  }
  return null;
}

function resolveUrl(src: string, pageUrl: string): string {
  try {
    return new URL(src, pageUrl).href;
  } catch {
    return src;
  }
}

export interface ScriptAnalysisResult {
  totalExternal: number;
  issues: ScriptIssue[];
}

export function analyzeScripts(body: string, pageUrl: string): ScriptAnalysisResult {
  const issues: ScriptIssue[] = [];
  let totalExternal = 0;
  let match: RegExpExecArray | null;

  while ((match = SCRIPT_TAG_PATTERN.exec(body)) !== null) {
    const attrs = match[1];
    const srcMatch = attrs.match(SRC_ATTR_PATTERN);
    if (!srcMatch) continue;

    const rawSrc = srcMatch[1] ?? srcMatch[2];
    if (!rawSrc) continue;

    const isExternal = isExternalUrl(rawSrc);
    if (!isExternal) continue;

    totalExternal++;
    const resolvedUrl = resolveUrl(rawSrc, pageUrl);
    const integrityMatch = attrs.match(INTEGRITY_ATTR_PATTERN);
    const hasSri = !!(integrityMatch && (integrityMatch[1] || integrityMatch[2]));
    const libraryMatch = findVulnerableLibrary(rawSrc);
    const scriptIssues: string[] = [];

    if (SCRIPT_ANALYSIS_CONFIG.checkSri && !hasSri) {
      scriptIssues.push(`Missing Subresource Integrity on external script: ${resolvedUrl}`);
    }

    if (libraryMatch) {
      scriptIssues.push(`Known vulnerable library detected: ${libraryMatch} (${resolvedUrl})`);
    }

    if (scriptIssues.length === 0) continue;
    issues.push({ url: resolvedUrl, pageUrl, issues: scriptIssues, isExternal, hasSri, libraryMatch });
  }

  return { totalExternal, issues };
}
