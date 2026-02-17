export const HEADER_RULES = {
  hsts: {
    minMaxAge: 31536000,
    maxAgePattern: /max-age=(\d+)/i,
    subDomainsPattern: /includeSubDomains/i,
  },
  csp: {
    unsafeDirectives: [/unsafe-inline/i, /unsafe-eval/i],
  },
  xContentTypeOptions: {
    expectedValue: "nosniff",
  },
  xFrameOptions: {
    validValues: ["DENY", "SAMEORIGIN"],
  },
  referrerPolicy: {
    weakValues: ["unsafe-url"],
  },
  infoLeakageHeaders: [
    { key: "server", display: "Server" },
    { key: "x-powered-by", display: "X-Powered-By" },
  ],
};
