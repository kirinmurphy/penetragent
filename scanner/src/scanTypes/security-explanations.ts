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

  "Certificate expired": {
    what: "The SSL/TLS certificate has passed its validity date and is no longer trusted by browsers.",
    why: "Expired certificates cause browser security warnings that drive users away and indicate the site may be unmaintained or compromised.",
    remediation: {
      generic: "Renew the certificate immediately. Consider using Let's Encrypt with auto-renewal (certbot renew) to prevent future expirations.",
      frameworks: {
        "nginx": "certbot --nginx -d yourdomain.com && systemctl reload nginx",
        "Apache": "certbot --apache -d yourdomain.com && systemctl reload apache2",
      },
    },
  },

  "Self-signed certificate": {
    what: "The certificate was signed by the server itself rather than a trusted Certificate Authority.",
    why: "Self-signed certificates are not trusted by browsers, causing security warnings. They also make the site vulnerable to man-in-the-middle attacks since there is no third-party verification of identity.",
    remediation: {
      generic: "Replace with a certificate from a trusted CA. Let's Encrypt provides free, automated certificates: certbot certonly --standalone -d yourdomain.com",
      frameworks: {
        "nginx": "certbot --nginx -d yourdomain.com",
        "Apache": "certbot --apache -d yourdomain.com",
      },
    },
  },

  "Hostname mismatch": {
    what: "The certificate's Subject Alternative Names (SANs) do not include the hostname being accessed.",
    why: "Browsers will show a security warning because the certificate does not prove the identity of the server being accessed. This could indicate a misconfigured server or a man-in-the-middle attack.",
    remediation: {
      generic: "Reissue the certificate with the correct hostname in the Subject Alternative Names. For Let's Encrypt: certbot certonly -d yourdomain.com -d www.yourdomain.com",
    },
  },

  "TLS 1.0 supported": {
    what: "The server supports TLS 1.0, which has known security vulnerabilities including BEAST and POODLE attacks.",
    why: "TLS 1.0 is deprecated by RFC 8996 (2021) and is no longer considered secure. PCI DSS compliance requires disabling TLS 1.0.",
    remediation: {
      generic: "Disable TLS 1.0 in your server configuration. Minimum recommended version is TLS 1.2.",
      frameworks: {
        "nginx": "ssl_protocols TLSv1.2 TLSv1.3;",
        "Apache": "SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1",
      },
    },
  },

  "TLS 1.1 supported": {
    what: "The server supports TLS 1.1, which is deprecated and has known weaknesses.",
    why: "TLS 1.1 is deprecated by RFC 8996 (2021). Major browsers have removed TLS 1.1 support.",
    remediation: {
      generic: "Disable TLS 1.1 in your server configuration. Minimum recommended version is TLS 1.2.",
      frameworks: {
        "nginx": "ssl_protocols TLSv1.2 TLSv1.3;",
        "Apache": "SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1",
      },
    },
  },

  "TLS 1.2 not supported": {
    what: "The server does not support TLS 1.2, the minimum recommended protocol version.",
    why: "TLS 1.2 is required for compatibility with modern browsers and for PCI DSS compliance. Without it, clients may be forced to use insecure older protocols.",
    remediation: {
      generic: "Enable TLS 1.2 (and preferably TLS 1.3) in your server configuration.",
      frameworks: {
        "nginx": "ssl_protocols TLSv1.2 TLSv1.3;",
        "Apache": "SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1",
      },
    },
  },

  "Weak cipher": {
    what: "The server negotiated a cipher suite that uses known-weak algorithms (RC4, DES, 3DES, EXPORT, NULL, or anonymous key exchange).",
    why: "Weak ciphers can be broken by attackers, allowing them to decrypt intercepted traffic and steal sensitive data.",
    remediation: {
      generic: "Configure your server to use only strong cipher suites. Recommended: ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20",
      frameworks: {
        "nginx": "ssl_ciphers 'ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20';\nssl_prefer_server_ciphers on;",
        "Apache": "SSLCipherSuite ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20\nSSLHonorCipherOrder on",
      },
    },
  },

  "No forward secrecy": {
    what: "The negotiated cipher suite does not support forward secrecy (PFS).",
    why: "Without forward secrecy, if the server's private key is ever compromised, all past encrypted traffic can be decrypted retroactively.",
    remediation: {
      generic: "Configure your server to prefer cipher suites with ECDHE or DHE key exchange, which provide forward secrecy.",
      frameworks: {
        "nginx": "ssl_ciphers 'ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20';\nssl_prefer_server_ciphers on;",
        "Apache": "SSLCipherSuite ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20\nSSLHonorCipherOrder on",
      },
    },
  },

  "Missing HttpOnly flag": {
    what: "A cookie is set without the HttpOnly flag, making it accessible to JavaScript via document.cookie.",
    why: "If an attacker exploits an XSS vulnerability, they can steal session cookies and hijack user accounts. HttpOnly prevents JavaScript access to the cookie.",
    remediation: {
      generic: "Set the HttpOnly flag on all session and authentication cookies.",
      frameworks: {
        "Express": "res.cookie('session', value, { httpOnly: true, secure: true, sameSite: 'lax' })",
        "PHP": "In php.ini: session.cookie_httponly = 1\nOr per-cookie: setcookie('name', 'value', ['httponly' => true])",
        "nginx": "If setting cookies via proxy_cookie_flags: proxy_cookie_flags ~ httponly;",
      },
    },
  },

  "Missing Secure flag": {
    what: "A cookie is set without the Secure flag, meaning it can be transmitted over unencrypted HTTP connections.",
    why: "Without the Secure flag, cookies can be intercepted by network attackers during HTTP requests, even if the site primarily uses HTTPS.",
    remediation: {
      generic: "Set the Secure flag on all cookies, especially session and authentication cookies.",
      frameworks: {
        "Express": "res.cookie('session', value, { secure: true, httpOnly: true, sameSite: 'lax' })",
        "PHP": "In php.ini: session.cookie_secure = 1\nOr per-cookie: setcookie('name', 'value', ['secure' => true])",
        "nginx": "If setting cookies via proxy_cookie_flags: proxy_cookie_flags ~ secure;",
      },
    },
  },

  "Missing SameSite attribute": {
    what: "A cookie is set without a SameSite attribute, leaving the browser to apply its default policy.",
    why: "Without an explicit SameSite attribute, cookies may be sent with cross-site requests, enabling CSRF attacks. While modern browsers default to Lax, explicit setting ensures consistent behavior.",
    remediation: {
      generic: "Set SameSite=Lax (or Strict for sensitive cookies) on all cookies.",
      frameworks: {
        "Express": "res.cookie('session', value, { sameSite: 'lax', secure: true, httpOnly: true })",
        "PHP": "In php.ini: session.cookie_samesite = Lax\nOr per-cookie: setcookie('name', 'value', ['samesite' => 'Lax'])",
      },
    },
  },

  "Missing Subresource Integrity": {
    what: "An external script is loaded without a Subresource Integrity (SRI) hash, so the browser cannot verify the file has not been tampered with.",
    why: "If the CDN or third-party host is compromised, an attacker can modify the script to inject malicious code into your site. SRI ensures the browser only executes scripts that match the expected hash.",
    remediation: {
      generic: "Add an integrity attribute to external script tags:\n<script src=\"https://cdn.example.com/lib.js\" integrity=\"sha384-...\" crossorigin=\"anonymous\"></script>\nGenerate hashes with: openssl dgst -sha384 -binary lib.js | openssl base64 -A",
    },
  },

  "Known vulnerable library": {
    what: "A script URL matches a known vulnerable library version pattern.",
    why: "Outdated JavaScript libraries often contain publicly disclosed vulnerabilities that attackers can exploit. These include XSS, prototype pollution, and remote code execution.",
    remediation: {
      generic: "Update to the latest stable version of the library. Check vulnerability databases (Snyk, npm audit) for specific CVEs and migration guides.",
    },
  },

  "CORS origin reflection": {
    what: "The server reflects the Origin header in the Access-Control-Allow-Origin response header, accepting requests from any origin.",
    why: "Origin reflection is equivalent to a wildcard but bypasses the browser restriction that prevents credentials with wildcard origins. Attackers can make authenticated cross-origin requests from malicious sites.",
    remediation: {
      generic: "Validate the Origin header against an explicit allowlist of trusted origins. Never reflect the Origin header directly.",
      frameworks: {
        "Express": "const cors = require('cors');\napp.use(cors({ origin: ['https://trusted.example.com'], credentials: true }));",
        "nginx": "Use a map block to validate $http_origin against allowed origins:\nmap $http_origin $cors_origin {\n  default '';\n  'https://trusted.example.com' $http_origin;\n}\nadd_header Access-Control-Allow-Origin $cors_origin;",
      },
    },
  },

  "CORS credential reflection": {
    what: "The server reflects the Origin header AND sets Access-Control-Allow-Credentials: true, the most dangerous CORS misconfiguration.",
    why: "This allows any website to make authenticated requests on behalf of the user. An attacker can read private data, perform actions, and fully impersonate the user via a malicious page.",
    remediation: {
      generic: "Never reflect the Origin header when Allow-Credentials is true. Use a strict allowlist of trusted origins.",
      frameworks: {
        "Express": "const cors = require('cors');\napp.use(cors({ origin: ['https://trusted.example.com'], credentials: true }));",
        "nginx": "Validate $http_origin against a strict allowlist and only set Allow-Credentials for matched origins.",
      },
    },
  },

  "Wildcard CORS origin": {
    what: "The server returns Access-Control-Allow-Origin: *, allowing any website to read responses from this server.",
    why: "While wildcard CORS does not allow credentialed requests, it permits any site to read public API responses. This can expose internal data if the endpoint is not truly public.",
    remediation: {
      generic: "If the endpoint serves public data (e.g., a public API), wildcard is acceptable. Otherwise, restrict to specific trusted origins.",
      frameworks: {
        "Express": "const cors = require('cors');\napp.use(cors({ origin: 'https://trusted.example.com' }));",
        "nginx": "add_header Access-Control-Allow-Origin 'https://trusted.example.com' always;",
      },
    },
  },

  "Certificate chain incomplete": {
    what: "The server did not provide a complete certificate chain back to a trusted root CA.",
    why: "An incomplete chain may cause some clients to reject the certificate, especially on mobile devices or older systems that don't have the intermediate CA cached.",
    remediation: {
      generic: "Configure your server to send the full certificate chain. Concatenate your certificate with the intermediate CA certificates in the correct order.",
      frameworks: {
        "nginx": "ssl_certificate /path/to/fullchain.pem;  # includes intermediates",
        "Apache": "SSLCertificateChainFile /path/to/chain.pem",
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
