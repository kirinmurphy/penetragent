export interface SecurityExplanation {
  what: string;
  why: string;
  remediation: {
    generic: string;
    frameworks?: Record<string, string>;
  };
}

export const SECURITY_EXPLANATIONS: Record<string, SecurityExplanation> = {
  "Strict-Transport-Security": {
    what: "HSTS tells browsers to only connect to your site over HTTPS, preventing protocol downgrade attacks and cookie hijacking.",
    why: "Without HSTS, an attacker on the same network can intercept the initial HTTP request before the redirect to HTTPS, stealing session cookies or injecting malicious content.",
    remediation: {
      generic: "Add the header: Strict-Transport-Security: max-age=31536000; includeSubDomains\nOptionally add 'preload' to protect the very first visit, but this is a long-term commitment — see hstspreload.org before opting in.",
      frameworks: {
        "nginx": 'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;',
        "Apache": "Header always set Strict-Transport-Security \"max-age=31536000; includeSubDomains\"",
        "Express": "app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true }))",
        "Next.js": "In next.config.js headers(): [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]",
        "WordPress": "Add to .htaccess: Header always set Strict-Transport-Security \"max-age=31536000; includeSubDomains\"",
      },
    },
  },

  "Content-Security-Policy": {
    what: "CSP controls which resources (scripts, styles, images) the browser is allowed to load, providing a strong defense against XSS attacks.",
    why: "Without CSP, any injected script tag or inline JavaScript will execute in the user's browser. CSP acts as a second line of defense even if your application has an XSS vulnerability.",
    remediation: {
      generic: "Start with: Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'\nNote: 'unsafe-inline' for styles is sometimes needed for CSS-in-JS frameworks, but weakens CSP. Prefer nonce- or hash-based allowlisting when feasible. Consider deploying in report-only mode first (Content-Security-Policy-Report-Only) to catch breakage.",
      frameworks: {
        "nginx": "add_header Content-Security-Policy \"default-src 'self'\" always;",
        "Apache": "Header always set Content-Security-Policy \"default-src 'self'\"",
        "Express": "app.use(helmet.contentSecurityPolicy({ directives: { defaultSrc: [\"'self'\"] } }))",
        "Next.js": "In next.config.js headers(): [{ key: 'Content-Security-Policy', value: \"default-src 'self'\" }]",
        "WordPress": "Add to .htaccess: Header always set Content-Security-Policy \"default-src 'self'\"",
      },
    },
  },

  "X-Content-Type-Options": {
    what: "Prevents the browser from MIME-type sniffing, which could cause a non-executable file to be treated as executable.",
    why: "Without this header, browsers may interpret files differently than intended (e.g., treating an uploaded image as JavaScript), enabling attacks.",
    remediation: {
      generic: "Add the header: X-Content-Type-Options: nosniff",
      frameworks: {
        "nginx": "add_header X-Content-Type-Options nosniff always;",
        "Apache": "Header always set X-Content-Type-Options nosniff",
        "Express": "app.use(helmet.noSniff())",
        "Next.js": "Next.js sets this automatically. Verify it's not being stripped by a reverse proxy.",
        "WordPress": "Add to .htaccess: Header always set X-Content-Type-Options nosniff",
      },
    },
  },

  "X-Frame-Options": {
    what: "Controls whether your site can be embedded in iframes, preventing clickjacking attacks.",
    why: "Without this header, an attacker can embed your site in a transparent iframe and trick users into clicking hidden buttons (e.g., changing account settings, making purchases).",
    remediation: {
      generic: "Add the header: X-Frame-Options: DENY (or SAMEORIGIN if you need iframes from your own domain)",
      frameworks: {
        "nginx": "add_header X-Frame-Options DENY always;",
        "Apache": "Header always set X-Frame-Options DENY",
        "Express": "app.use(helmet.frameguard({ action: 'deny' }))",
        "Next.js": "In next.config.js headers(): [{ key: 'X-Frame-Options', value: 'DENY' }]",
        "WordPress": "Add to .htaccess: Header always set X-Frame-Options DENY",
      },
    },
  },

  "Referrer-Policy": {
    what: "Controls how much referrer information is included with navigation requests and resource fetches.",
    why: "Without a policy, the full URL (including query parameters that may contain tokens or sensitive data) is sent as a referrer to external sites.",
    remediation: {
      generic: "Add the header: Referrer-Policy: strict-origin-when-cross-origin",
      frameworks: {
        "nginx": "add_header Referrer-Policy strict-origin-when-cross-origin always;",
        "Apache": "Header always set Referrer-Policy strict-origin-when-cross-origin",
        "Express": "app.use(helmet.referrerPolicy({ policy: 'strict-origin-when-cross-origin' }))",
        "Next.js": "In next.config.js headers(): [{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }]",
        "WordPress": "Add to .htaccess: Header always set Referrer-Policy strict-origin-when-cross-origin",
      },
    },
  },

  "Permissions-Policy": {
    what: "Controls which browser features (camera, microphone, geolocation, etc.) your site and embedded content can use.",
    why: "Without this header, any embedded third-party content can request access to sensitive device features. Setting a restrictive policy limits the attack surface.",
    remediation: {
      generic: "Add the header: Permissions-Policy: camera=(), microphone=(), geolocation=()",
      frameworks: {
        "nginx": "add_header Permissions-Policy \"camera=(), microphone=(), geolocation=()\" always;",
        "Apache": "Header always set Permissions-Policy \"camera=(), microphone=(), geolocation=()\"",
        "Express": "res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')",
        "Next.js": "In next.config.js headers(): [{ key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }]",
        "WordPress": "Add to .htaccess: Header always set Permissions-Policy \"camera=(), microphone=(), geolocation=()\"",
      },
    },
  },

  "Mixed content detected": {
    what: "The page is served over HTTPS but loads resources (images, scripts, stylesheets) over insecure HTTP.",
    why: "Mixed content can be intercepted and modified by attackers, undermining the security of the HTTPS page. Browsers may block some mixed content entirely.",
    remediation: {
      generic: "Update all resource URLs to use https:// explicitly. Add Content-Security-Policy: upgrade-insecure-requests as a safety net to automatically upgrade any remaining HTTP resources.",
      frameworks: {
        "WordPress": "Install and run the Better Search Replace plugin to update http:// URLs in the database to https://.",
        "nginx": "add_header Content-Security-Policy \"upgrade-insecure-requests\" always;",
      },
    },
  },

  "Potential XSS pattern detected": {
    what: "Inline JavaScript patterns were found that may indicate a cross-site scripting vulnerability or unsafe coding practice.",
    why: "XSS vulnerabilities allow attackers to inject malicious scripts that execute in other users' browsers, potentially stealing sessions, credentials, or performing actions on behalf of the user.",
    remediation: {
      generic: "Sanitize all user input before rendering. Use Content-Security-Policy to block inline scripts. Encode HTML entities in dynamic content.",
      frameworks: {
        "Express": "Use a templating engine with auto-escaping (e.g., EJS, Handlebars). Never use innerHTML with user data.",
        "Next.js": "React auto-escapes JSX by default. Avoid dangerouslySetInnerHTML with user input.",
      },
    },
  },

  "Server header disclosed": {
    what: "The Server response header reveals the web server software and version.",
    why: "Disclosing the server version helps attackers find known vulnerabilities for that specific version.",
    remediation: {
      generic: "Configure your web server to suppress or minimize the Server header.",
      frameworks: {
        "nginx": "server_tokens off;",
        "Apache": "ServerTokens Prod\nServerSignature Off",
        "Express": "Express does not set a Server header by default. If present, it is likely added by a reverse proxy (nginx, Apache) — suppress it there instead.",
      },
    },
  },

  "X-Powered-By header disclosed": {
    what: "The X-Powered-By header reveals the application framework or runtime.",
    why: "This information helps attackers identify the technology stack and target known vulnerabilities specific to that framework or version.",
    remediation: {
      generic: "Remove the X-Powered-By header in your application or web server configuration.",
      frameworks: {
        "Express": "app.disable('x-powered-by') or use helmet: app.use(helmet())",
        "Next.js": "In next.config.js: module.exports = { poweredByHeader: false }",
        "PHP": "In php.ini: expose_php = Off",
        "ASP.NET": "In web.config: <httpRuntime enableVersionHeader=\"false\" />",
      },
    },
  },
};

export function findExplanation(key: string): SecurityExplanation | undefined {
  const normalized = key.trim().toLowerCase();

  const exactMatch = Object.keys(SECURITY_EXPLANATIONS).find(
    (k) => k.toLowerCase() === normalized,
  );
  if (exactMatch) return SECURITY_EXPLANATIONS[exactMatch];

  const prefixMatch = Object.entries(SECURITY_EXPLANATIONS).find(
    ([k]) => normalized.startsWith(k.toLowerCase()),
  );
  return prefixMatch ? prefixMatch[1] : undefined;
}
