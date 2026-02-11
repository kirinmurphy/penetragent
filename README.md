# Penetragent

A security scanning tool you control by sending text messages to a Telegram bot. You tell it "scan this website" and it checks whether the site has its security settings configured properly. It reports back with a grade card — like a health inspection for websites.

## Getting Started

Follow [these instructions](./docs/getting-started.md) to set up and run Penetragent locally or on a VPS.

## The Two Pieces

There are only two services:

**The Controller** is a Telegram chatbot. It's the interface — the only thing you talk to. It doesn't do any scanning itself. When you say `scan https://example.com`, it passes that request along to the scanner and then keeps checking back until the scan is done. When results are ready, it messages you.

**The Scanner** is the backend that does the real work. It has a small HTTP API (like a web server), a SQLite database to track jobs, and a background worker that picks up scan requests and executes them one at a time. You can also talk to it directly with curl if you don't want to use Telegram.

## What Happens When You Run a Scan

1. You DM the bot: `scan https://example.com` (or use curl directly)
2. The bot sends that request to the scanner's API
3. The scanner creates a job record in the database (status: QUEUED) and responds immediately
4. The bot tells you "Scan started!" and begins checking the job status every few seconds in the background
5. The scanner's worker notices the queued job and picks it up (status: RUNNING)
6. Before touching the target website, the worker resolves its hostname via DNS and checks that every IP address is public — not localhost, not an internal network address, not anything that could be used to probe infrastructure it shouldn't reach
7. If the IPs are safe, the worker fetches the website and examines the HTTP response headers
8. It grades six security headers (things like "does this site force HTTPS?" and "does it prevent clickjacking?") as good, weak, or missing
9. It also flags information leakage — headers like `Server: Apache/2.4.51` that reveal what software is running
10. Results are saved to a JSON file and a summary is written to the database (status: SUCCEEDED)
11. The bot's background poller sees the job is done and messages you the results

## What It Checks (The Headers Scan Type)

When you run a "headers" scan, it's answering these questions about the target website:

- **Is HTTPS enforced?** (Strict-Transport-Security) — Does the site tell browsers to always use encryption?
- **Is JavaScript locked down?** (Content-Security-Policy) — Does the site restrict where scripts can load from?
- **Is MIME sniffing blocked?** (X-Content-Type-Options) — Does the site prevent browsers from guessing file types?
- **Is framing blocked?** (X-Frame-Options) — Can other sites embed this one in an iframe (clickjacking risk)?
- **Is referrer leakage controlled?** (Referrer-Policy) — Does the site leak full URLs when users click outbound links?
- **Are browser features restricted?** (Permissions-Policy) — Does the site disable camera, microphone, etc. for embedded content?
- **Is software version exposed?** (Server, X-Powered-By) — Can an attacker see what server software and version is running?

## Safety Guards

- **Single user only** — The bot ignores messages from anyone except your Telegram account. No response, no error, just silence.
- **One scan at a time** — If a scan is already running, new requests are rejected. No queue pileup, no parallel scanning.
- **Public IPs only** — Before making any HTTP request, every resolved IP is checked against blocked ranges (localhost, private networks, link-local, etc.). This prevents the scanner from being tricked into probing internal infrastructure.
- **Crash recovery** — If the scanner process dies mid-scan, the next startup detects the abandoned job via a stale heartbeat and marks it as failed rather than leaving it stuck forever.

## Why Two Services?

Separation of concerns. The scanner is a standalone HTTP API that works without Telegram — you can test everything with curl. The controller is just a thin chat interface on top. This means:

- You can develop and test the scanning logic without needing a Telegram bot token
- You could swap in a different interface (Slack, CLI, web UI) without touching the scanner
- In Docker, the two containers communicate over a private bridge network — the scanner is never exposed to the internet

See [docs/howitworks/](./docs/howitworks/index.md) for architecture diagrams.
