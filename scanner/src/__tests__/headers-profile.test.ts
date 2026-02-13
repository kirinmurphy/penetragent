import { describe, it, expect } from "vitest";
import {
  gradeHsts,
  gradeCsp,
  gradeXContentTypeOptions,
  gradeXFrameOptions,
  gradeReferrerPolicy,
  gradePermissionsPolicy,
  detectInfoLeakage,
} from "../scanTypes/headers.js";

describe("gradeHsts", () => {
  it("missing → missing", () => {
    expect(gradeHsts(null).grade).toBe("missing");
  });

  it("short max-age → weak", () => {
    expect(gradeHsts("max-age=3600").grade).toBe("weak");
  });

  it("good max-age without includeSubDomains → weak", () => {
    expect(gradeHsts("max-age=31536000").grade).toBe("weak");
  });

  it("good max-age with includeSubDomains → good", () => {
    expect(
      gradeHsts("max-age=31536000; includeSubDomains").grade,
    ).toBe("good");
  });

  it("longer max-age with includeSubDomains → good", () => {
    expect(
      gradeHsts("max-age=63072000; includeSubDomains; preload").grade,
    ).toBe("good");
  });
});

describe("gradeCsp", () => {
  it("missing → missing", () => {
    expect(gradeCsp(null).grade).toBe("missing");
  });

  it("with unsafe-inline → weak", () => {
    expect(gradeCsp("default-src 'self' 'unsafe-inline'").grade).toBe(
      "weak",
    );
  });

  it("with unsafe-eval → weak", () => {
    expect(gradeCsp("default-src 'self' 'unsafe-eval'").grade).toBe(
      "weak",
    );
  });

  it("safe policy → good", () => {
    expect(gradeCsp("default-src 'self'").grade).toBe("good");
  });
});

describe("gradeXContentTypeOptions", () => {
  it("missing → missing", () => {
    expect(gradeXContentTypeOptions(null).grade).toBe("missing");
  });

  it("nosniff → good", () => {
    expect(gradeXContentTypeOptions("nosniff").grade).toBe("good");
  });

  it("other value → weak", () => {
    expect(gradeXContentTypeOptions("something").grade).toBe("weak");
  });
});

describe("gradeXFrameOptions", () => {
  it("missing → missing", () => {
    expect(gradeXFrameOptions(null).grade).toBe("missing");
  });

  it("DENY → good", () => {
    expect(gradeXFrameOptions("DENY").grade).toBe("good");
  });

  it("SAMEORIGIN → good", () => {
    expect(gradeXFrameOptions("SAMEORIGIN").grade).toBe("good");
  });

  it("ALLOW-FROM → weak", () => {
    expect(gradeXFrameOptions("ALLOW-FROM http://x.com").grade).toBe(
      "weak",
    );
  });
});

describe("gradeReferrerPolicy", () => {
  it("missing → missing", () => {
    expect(gradeReferrerPolicy(null).grade).toBe("missing");
  });

  it("unsafe-url → weak", () => {
    expect(gradeReferrerPolicy("unsafe-url").grade).toBe("weak");
  });

  it("no-referrer → good", () => {
    expect(gradeReferrerPolicy("no-referrer").grade).toBe("good");
  });

  it("strict-origin-when-cross-origin → good", () => {
    expect(
      gradeReferrerPolicy("strict-origin-when-cross-origin").grade,
    ).toBe("good");
  });
});

describe("gradePermissionsPolicy", () => {
  it("missing → missing", () => {
    expect(gradePermissionsPolicy(null).grade).toBe("missing");
  });

  it("present → good", () => {
    expect(
      gradePermissionsPolicy("camera=(), microphone=()").grade,
    ).toBe("good");
  });
});

describe("detectInfoLeakage", () => {
  it("detects Server header", () => {
    const headers = new Headers({ Server: "Apache/2.4.51" });
    const leaks = detectInfoLeakage(headers);
    expect(leaks).toHaveLength(1);
    expect(leaks[0].header).toBe("Server");
    expect(leaks[0].value).toBe("Apache/2.4.51");
  });

  it("detects X-Powered-By header", () => {
    const headers = new Headers({ "X-Powered-By": "Express" });
    const leaks = detectInfoLeakage(headers);
    expect(leaks).toHaveLength(1);
    expect(leaks[0].header).toBe("X-Powered-By");
  });

  it("detects both", () => {
    const headers = new Headers({
      Server: "nginx",
      "X-Powered-By": "PHP/8.1",
    });
    const leaks = detectInfoLeakage(headers);
    expect(leaks).toHaveLength(2);
  });

  it("returns empty when no leaks", () => {
    const headers = new Headers({});
    expect(detectInfoLeakage(headers)).toHaveLength(0);
  });
});
