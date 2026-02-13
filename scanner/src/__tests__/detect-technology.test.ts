import { describe, it, expect } from "vitest";
import { detectTechnologies } from "../scanTypes/detect-technology.js";

const cases = [
  {
    name: "detects WordPress from URL patterns",
    input: {
      urls: ["https://example.com/wp-content/themes/style.css"],
      headers: [],
      metaGeneratorValues: [],
    },
    expected: [{ name: "WordPress", confidence: "medium" }],
  },
  {
    name: "detects WordPress from meta generator (high confidence)",
    input: {
      urls: [],
      headers: [],
      metaGeneratorValues: ["WordPress 6.3"],
    },
    expected: [{ name: "WordPress", confidence: "high" }],
  },
  {
    name: "detects Next.js from _next URL pattern",
    input: {
      urls: ["https://example.com/_next/static/chunks/main.js"],
      headers: [],
      metaGeneratorValues: [],
    },
    expected: [{ name: "Next.js", confidence: "medium" }],
  },
  {
    name: "detects Express from X-Powered-By header",
    input: {
      urls: [],
      headers: [{ header: "X-Powered-By", value: "Express" }],
      metaGeneratorValues: [],
    },
    expected: [{ name: "Express", confidence: "high" }],
  },
  {
    name: "detects nginx from Server header",
    input: {
      urls: [],
      headers: [{ header: "Server", value: "nginx/1.24.0" }],
      metaGeneratorValues: [],
    },
    expected: [{ name: "nginx", confidence: "high" }],
  },
  {
    name: "detects Apache from Server header",
    input: {
      urls: [],
      headers: [{ header: "Server", value: "Apache/2.4.51 (Ubuntu)" }],
      metaGeneratorValues: [],
    },
    expected: [{ name: "Apache", confidence: "high" }],
  },
  {
    name: "detects PHP from X-Powered-By header",
    input: {
      urls: [],
      headers: [{ header: "X-Powered-By", value: "PHP/8.2.1" }],
      metaGeneratorValues: [],
    },
    expected: [{ name: "PHP", confidence: "high" }],
  },
  {
    name: "detects Drupal from URL patterns",
    input: {
      urls: ["https://example.com/sites/default/files/image.png"],
      headers: [],
      metaGeneratorValues: [],
    },
    expected: [{ name: "Drupal", confidence: "medium" }],
  },
  {
    name: "detects multiple technologies",
    input: {
      urls: ["https://example.com/wp-content/uploads/photo.jpg"],
      headers: [
        { header: "Server", value: "Apache/2.4" },
        { header: "X-Powered-By", value: "PHP/8.1" },
      ],
      metaGeneratorValues: ["WordPress 6.4"],
    },
    expected: [
      { name: "WordPress", confidence: "high" },
      { name: "Apache", confidence: "high" },
      { name: "PHP", confidence: "high" },
    ],
  },
  {
    name: "returns empty array when no signals",
    input: {
      urls: ["https://example.com/about"],
      headers: [],
      metaGeneratorValues: [],
    },
    expected: [],
  },
];

describe("detectTechnologies", () => {
  for (const { name, input, expected } of cases) {
    it(name, () => {
      const result = detectTechnologies(input);
      expect(result).toHaveLength(expected.length);
      for (const exp of expected) {
        const found = result.find((r) => r.name === exp.name);
        expect(found).toBeDefined();
        expect(found!.confidence).toBe(exp.confidence);
      }
    });
  }

  it("deduplicates by tech name, keeping highest confidence", () => {
    const result = detectTechnologies({
      urls: ["https://example.com/wp-content/themes/style.css"],
      headers: [],
      metaGeneratorValues: ["WordPress 6.3"],
    });
    const wordpress = result.filter((r) => r.name === "WordPress");
    expect(wordpress).toHaveLength(1);
    expect(wordpress[0].confidence).toBe("high");
  });
});
