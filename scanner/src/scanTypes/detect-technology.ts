import type { DetectedTechnology } from "@penetragent/shared";

interface TechRule {
  name: string;
  urlPatterns?: RegExp[];
  headerMatches?: { header: string; pattern: RegExp }[];
  metaGeneratorPatterns?: RegExp[];
}

const TECH_RULES: TechRule[] = [
  {
    name: "WordPress",
    urlPatterns: [/\/wp-content\//, /\/wp-includes\//, /\/wp-admin\//, /\/wp-json\//],
    metaGeneratorPatterns: [/WordPress/i],
  },
  {
    name: "Drupal",
    urlPatterns: [/\/sites\/default\//, /\/modules\//, /\/themes\/contrib\//],
    metaGeneratorPatterns: [/Drupal/i],
  },
  {
    name: "Joomla",
    urlPatterns: [/\/components\/com_/, /\/media\/jui\//],
    metaGeneratorPatterns: [/Joomla/i],
  },
  {
    name: "Next.js",
    urlPatterns: [/\/_next\//, /\/__next\//],
    metaGeneratorPatterns: [/Next\.js/i],
  },
  {
    name: "Nuxt.js",
    urlPatterns: [/\/_nuxt\//],
    metaGeneratorPatterns: [/Nuxt/i],
  },
  {
    name: "Hugo",
    metaGeneratorPatterns: [/Hugo/i],
  },
  {
    name: "Ghost",
    metaGeneratorPatterns: [/Ghost/i],
  },
  {
    name: "nginx",
    headerMatches: [{ header: "Server", pattern: /nginx/i }],
  },
  {
    name: "Apache",
    headerMatches: [{ header: "Server", pattern: /Apache/i }],
  },
  {
    name: "Express",
    headerMatches: [{ header: "X-Powered-By", pattern: /Express/i }],
  },
  {
    name: "PHP",
    headerMatches: [{ header: "X-Powered-By", pattern: /PHP/i }],
  },
  {
    name: "ASP.NET",
    headerMatches: [{ header: "X-Powered-By", pattern: /ASP\.NET/i }],
  },
  {
    name: "Cloudflare",
    headerMatches: [{ header: "Server", pattern: /cloudflare/i }],
  },
];

interface DetectionInput {
  urls: string[];
  headers: { header: string; value: string }[];
  metaGeneratorValues: string[];
}

const CONFIDENCE_RANK = { high: 3, medium: 2, low: 1 } as const;

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
