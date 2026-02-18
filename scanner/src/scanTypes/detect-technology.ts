import type { DetectedTechnology } from "@penetragent/shared";
import { TECH_RULES, CONFIDENCE_RANK } from "../config/scan-rules.js";

interface DetectionInput {
  urls: string[];
  headers: { header: string; value: string }[];
  metaGeneratorValues: string[];
  tlsCertIssuer?: string;
}

export function detectTechnologies(input: DetectionInput): DetectedTechnology[] {
  const found = new Map<string, DetectedTechnology>();

  function addDetection(name: string, confidence: DetectedTechnology["confidence"], source: string) {
    const existing = found.get(name);
    if (!existing || CONFIDENCE_RANK[confidence] > CONFIDENCE_RANK[existing.confidence]) {
      found.set(name, { name, confidence, source });
    }
  }

  for (const rule of TECH_RULES) {
    if (rule.metaGeneratorPatterns) {
      for (const gen of input.metaGeneratorValues) {
        for (const pattern of rule.metaGeneratorPatterns) {
          if (pattern.test(gen)) {
            addDetection(rule.name, "high", `meta generator: ${gen}`);
          }
        }
      }
    }

    if (rule.headerMatches) {
      for (const hdr of input.headers) {
        for (const match of rule.headerMatches) {
          if (hdr.header === match.header && match.pattern.test(hdr.value)) {
            addDetection(rule.name, "high", `${hdr.header}: ${hdr.value}`);
          }
        }
      }
    }

    if (rule.certIssuerPatterns && input.tlsCertIssuer) {
      for (const pattern of rule.certIssuerPatterns) {
        if (pattern.test(input.tlsCertIssuer)) {
          addDetection(rule.name, "high", `TLS certificate issuer: ${input.tlsCertIssuer}`);
        }
      }
    }

    if (rule.urlPatterns) {
      for (const url of input.urls) {
        for (const pattern of rule.urlPatterns) {
          if (pattern.test(url)) {
            addDetection(rule.name, "medium", `URL pattern: ${url}`);
            break;
          }
        }
      }
    }
  }

  return Array.from(found.values());
}
