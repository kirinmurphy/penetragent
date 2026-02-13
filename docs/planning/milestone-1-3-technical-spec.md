## M1–M3 build-ready technical spec (Node/TS monorepo) — updated with your latest feedback

### What's new vs the prior spec

* **Async Telegram UX**: `scan` always replies immediately with `jobId`, and controller can emit chat actions (`typing` / `upload_document`) during long operations.
* **"Double-IPv6" hardened**: sanity check resolves **all A + AAAA**, normalizes **IPv4-mapped IPv6** (e.g. `::ffff:192.168.1.1`), and fails closed if *any* resolved IP is restricted.
* **Report directory hygiene**: all artifacts must be written only to `REPORTS_DIR/<jobId>/` (this matters more in M4, but we enforce the pattern starting in M3).

---

# Repo layout

```
/penetragent
  /controller
  /scanner
  /shared
  /infra
  /data
  /reports
  .env.example
  docker-compose.yml
  docker-compose.dev.yml
```

---

# Shared contracts (`/shared`)

## Types (`shared/src/types.ts`)

* `JobStatus`: `QUEUED | RUNNING | SUCCEEDED | FAILED | FAILED_ON_RESTART`
* `ErrorCode`:

  * `PRIVATE_RANGE_RESTRICTED`
  * `INVALID_TARGET`
  * `INVALID_SCAN_TYPE`
  * `RATE_LIMITED`
  * `FAILED_ON_RESTART`
  * `INTERNAL_ERROR`

## Schemas (`shared/src/schemas.ts`)

* `ScanRequest`: `{ targetId: string, scanType: string, requestedBy: string }`
* `JobPublic`: fields returned by scanner API (id/status/timestamps/error/summary)

Use a shared schema library (e.g. Zod) so controller+scanner validate the same shapes.

---

# Configuration + env vars

## Controller

* `TELEGRAM_BOT_TOKEN`
* `TELEGRAM_ALLOWED_USER_ID` (numeric string)
* `SCANNER_BASE_URL` (e.g. `http://scanner:8080`)
* `POLL_INTERVAL_MS` (e.g. `5000`)
* `POLL_TIMEOUT_MS` (e.g. `7200000`)

## Scanner

* `DB_PATH` (e.g. `/data/scanner.sqlite`)
* `REPORTS_DIR` (e.g. `/reports`)
* `HEARTBEAT_INTERVAL_MS` (e.g. `5000`)
* `HEARTBEAT_STALE_MS` (e.g. `30000`)
* `CONCURRENCY` (v1: `1`)

---

# Command grammar + exact Telegram responses (M1)

All commands are handled only if `from.id === TELEGRAM_ALLOWED_USER_ID`.

### `help`

```
Commands:
targets
scantypes
scan <targetId> <scanType>
status <jobId>
history [n]
```

### `targets`

```
Targets:
- staging
- prod
```

### `scantypes` (M1–M3)

```
Scan Types:
- headers
```

### `scan <targetId> <scanType>`

Must return immediately (no waiting for scan completion):

**Success**

```
Job started: <jobId>
target=<targetId> scanType=<scanType>
Use: status <jobId>
```

**Failures**

* Unknown target:

  ```
  Invalid target. Use: targets
  ```
* Unknown scan type:

  ```
  Invalid scan type. Use: scantypes
  ```
* Rate limited (scan already running):

  ```
  Scan already running: <runningJobId>
  Use: status <runningJobId>
  ```
* Scanner unavailable:

  ```
  Scanner unavailable. Try again later.
  ```

**UX requirements**

* Controller optionally calls Telegram `sendChatAction("typing")` right before sending the immediate "Job started" message (low friction feedback).
* Controller must run polling in a background task, not in the command handler.

### `status <jobId>`

Controller fetches scanner `GET /jobs/:jobId` and prints:

* `QUEUED`

  ```
  <jobId>
  status=QUEUED
  ```
* `RUNNING`

  ```
  <jobId>
  status=RUNNING
  started=<iso8601>
  ```
* `SUCCEEDED`

  ```
  <jobId>
  status=SUCCEEDED
  finished=<iso8601>
  summary=<one-line>
  ```
* `FAILED` / `FAILED_ON_RESTART`

  ```
  <jobId>
  status=<FAILED|FAILED_ON_RESTART>
  error=<error_code>
  ```

### `history [n]` (optional in M1, required in M2)

Default `n=5`.

```
History:
- <jobId> RUNNING staging headers
- <jobId> SUCCEEDED prod headers
```

Note: `headers` refers to the scan type, which is stored in the job record as a string field.

---

# Status machine (M2)

Canonical transitions:

* `QUEUED -> RUNNING -> SUCCEEDED`
* `QUEUED -> RUNNING -> FAILED`
* `RUNNING -> FAILED_ON_RESTART` (reconciliation)
* `QUEUED -> FAILED` (preflight sanity check fails before work starts)

Terminal: `SUCCEEDED`, `FAILED`, `FAILED_ON_RESTART`.

---

# Minimal DB schema (scanner-owned truth) (M2)

Scanner SQLite (required):

```sql
CREATE TABLE IF NOT EXISTS targets (
  id TEXT PRIMARY KEY,
  base_url TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  requested_by TEXT NOT NULL,
  target_id TEXT NOT NULL,
  scan_type TEXT NOT NULL DEFAULT 'headers',
  status TEXT NOT NULL,
  error_code TEXT,
  status_reason TEXT,
  worker_id TEXT,
  resolved_ips_json TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  last_heartbeat_at TEXT,
  report_path TEXT,
  summary_json TEXT,
  FOREIGN KEY(target_id) REFERENCES targets(id)
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_heartbeat ON jobs(last_heartbeat_at);
```

Seed (on boot if empty):

* `targets`: `staging`, `prod` (HTTPS hostnames)

Note: Scan types are defined in code (`shared/src/types.ts` → `SCAN_TYPES` constant), not in a database table.

---

# Scanner HTTP API (M3)

Private network only.

## `GET /health`

Response:

```json
{ "ok": true }
```

Used by docker-compose health check and controller readiness polling.

## `POST /scan`

Request:

```json
{ "targetId": "staging", "scanType": "headers", "requestedBy": "123456789" }
```

Behavior:

1. Validate `targetId` exists + enabled.
2. Validate `scanType` exists in `SCAN_TYPES` constant (code-based validation).
3. Create job with `status=QUEUED`.
4. Return `{ jobId }` immediately.
5. Worker processes queue.

Errors:

* 400 `{ "error": "INVALID_TARGET" }`
* 400 `{ "error": "INVALID_SCAN_TYPE" }`
* 429 `{ "error": "RATE_LIMITED", "runningJobId": "<id>" }`

## `GET /jobs/:jobId`

Response:

```json
{
  "id": "uuid",
  "status": "RUNNING",
  "errorCode": null,
  "createdAt": "iso",
  "startedAt": "iso|null",
  "finishedAt": "iso|null",
  "summary": {}
}
```

404 `{ "error": "NOT_FOUND" }` if jobId doesn't exist.

## `GET /jobs?limit=N&offset=0`

Returns a paginated list of jobs (newest first). Used by the controller `history` command.

Response:

```json
{
  "jobs": [ JobPublic, ... ],
  "total": 42
}
```

---

# Worker, heartbeat, reconciliation (M2/M3)

## Worker loop (single concurrency)

* Select oldest `QUEUED` job.
* Transition to `RUNNING`:

  * set `worker_id`
  * set `started_at`
  * set `last_heartbeat_at=now`
* Heartbeat:

  * update `last_heartbeat_at` every `HEARTBEAT_INTERVAL_MS`

## Reconciliation on scanner startup ("zombie job" fix)

On startup:

* Find `RUNNING` jobs where:

  * `last_heartbeat_at` is null, or
  * `now - last_heartbeat_at > HEARTBEAT_STALE_MS`
* Mark them:

  * `status=FAILED_ON_RESTART`
  * `error_code=FAILED_ON_RESTART`
  * `finished_at=now`
  * `status_reason='stale heartbeat on startup'`

---

# Public-only sanity check (M3 hard boundary)

**Requirements**

* Resolve **all** A and AAAA results.
* Normalize IPv4-mapped IPv6 (`::ffff:x.x.x.x`) to IPv4.
* Fail closed if *any* resolved address is restricted.
* Store `resolved_ips_json` on the job record (even on failure).
* No HTTP request occurs if sanity check fails.

**Recommended implementation approach (TypeScript)**
(2-space indent, no comments)

```ts
import ipaddr from "ipaddr.js"
import { lookup } from "node:dns/promises"

const restrictedRanges = new Set([
  "private",
  "loopback",
  "linkLocal",
  "uniqueLocal",
  "carrierGradeNat"
])

const normalize = (addr: string) => {
  const ip = ipaddr.parse(addr)
  const v6 = ip.kind() === "ipv6" ? ip : null
  const mapped = v6 && (v6 as any).isIPv4MappedAddress?.()
  return mapped ? (v6 as any).toIPv4Address() : ip
}

const isRestricted = (addr: string) => restrictedRanges.has(normalize(addr).range())

export const verifyPublicOnly = async (hostname: string) => {
  const records = await lookup(hostname, { all: true, verbatim: true })
  const addrs = records.map(r => r.address)
  if (addrs.length === 0) throw new Error("DNS_NO_RESULTS")
  if (addrs.some(isRestricted)) throw new Error("PRIVATE_RANGE_RESTRICTED")
  return addrs
}
```

**Note:** You'll still explicitly include your full restricted set from the PRD (RFC1918 + loopback + link-local + CGNAT + IPv6 ULA/link-local). The snippet shows the shape; you can expand `restrictedRanges` if you want to fail closed on additional `ipaddr.js` ranges.

---

# M3 scan type: `headers`

## Output boundaries (report hygiene)

All artifacts must be written under:

* `REPORTS_DIR/<jobId>/`

Never write outside that folder. Create the folder at job start and set `report_path` to it.

## What it collects

For `base_url`:

* `GET /` with timeout (e.g. 30s)
* Follow redirects, record the chain
* Record:

  * final URL after redirects
  * status code
  * TLS info (protocol version, certificate expiry if accessible)
  * security headers — check presence, value, and grade (missing / weak / good):
    * `Strict-Transport-Security` — look for `max-age`, `includeSubDomains`
    * `Content-Security-Policy` — present vs absent; flag overly permissive (`unsafe-inline`, `unsafe-eval`)
    * `X-Content-Type-Options` — should be `nosniff`
    * `X-Frame-Options` — `DENY` or `SAMEORIGIN`
    * `Referrer-Policy` — present and not `unsafe-url`
    * `Permissions-Policy` — present vs absent
  * notable non-security headers worth recording:
    * `Server` (information leakage)
    * `X-Powered-By` (information leakage)
* Write:

  * `REPORTS_DIR/<jobId>/headers.json` — full structured results
  * `summary_json` on job record — compact: counts of missing/weak/good headers, notable findings

---

# Controller background polling (M1+)

## Poller behavior

* Triggered after successful `scan`.
* Poll `GET /jobs/:id` every `POLL_INTERVAL_MS` until terminal or `POLL_TIMEOUT_MS`.
* On terminal:

  * DM status + summary immediately
  * (zips/files happen later in M5, but you can send a "completed" message now)

## Telegram "liveness" UX (optional)

* On job start: `sendChatAction("typing")` → send "Job started"
* On completion: `sendChatAction("typing")` → send summary
* When you add file sending (M5): `sendChatAction("upload_document")` before sending the zip

---

# docker-compose (M1–M3)

```yaml
services:
  controller:
    build: ../controller
    environment:
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      TELEGRAM_ALLOWED_USER_ID: ${TELEGRAM_ALLOWED_USER_ID}
      SCANNER_BASE_URL: http://scanner:8080
      POLL_INTERVAL_MS: "5000"
      POLL_TIMEOUT_MS: "7200000"
    depends_on:
      scanner:
        condition: service_healthy
    networks:
      - agent_net
    restart: unless-stopped

  scanner:
    build: ../scanner
    environment:
      DB_PATH: /data/scanner.sqlite
      REPORTS_DIR: /reports
      HEARTBEAT_INTERVAL_MS: "5000"
      HEARTBEAT_STALE_MS: "30000"
      CONCURRENCY: "1"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 5s
      timeout: 3s
      retries: 5
    volumes:
      - data:/data
      - reports:/reports
    networks:
      - agent_net
    restart: unless-stopped

volumes:
  data:
  reports:

networks:
  agent_net:
    driver: bridge
```

---

# Acceptance criteria

## M1

* Bot ignores all users except allowlisted Telegram ID.
* `scan staging headers` responds immediately with `jobId`.
* Controller does not block for scan completion.
* `scantypes` command lists available scan types from code.

## M2

* Jobs persist across restarts.
* Kill scanner mid-run → restart scanner → job becomes `FAILED_ON_RESTART` via reconciliation.

## M3

* `headers` scan type writes artifacts only under `REPORTS_DIR/<jobId>/`.
* Sanity check resolves all A/AAAA and fails on restricted ranges including IPv4-mapped IPv6 (e.g. `::ffff:192.168.1.1`).
* Scan type validation happens in code (SCAN_TYPES constant), not via database lookup.

---

# Prerequisites

## Telegram bot setup

1. Message `@BotFather` on Telegram → `/newbot` → save the token.
2. Get your numeric user ID: message `@userinfobot` or `@raw_data_bot`.
3. Add both values to `.env`.

## Colima (Docker runtime)

* Named volumes (used for `data:` and `reports:`) work out of the box.
* Ensure docker context is set: `docker context use colima` or set `DOCKER_HOST=unix://$HOME/.colima/default/docker.sock`.
* The `agent_net` bridge network works the same as native Docker Desktop.

## `.env.example`

```env
TELEGRAM_BOT_TOKEN=your-bot-token-here
TELEGRAM_ALLOWED_USER_ID=your-numeric-telegram-id
```

Repo root `.env` is gitignored. Copy `.env.example` to `.env` and fill in values.

---

# LLM provider interface (future: M6+)

Core scan/job machinery is fully deterministic — no LLM dependency. The LLM layer is optional enrichment that sits on top of raw reports.

```ts
// shared/src/llm.ts
export interface LlmProvider {
  summarize(prompt: string, data: unknown): Promise<string>
}
```

Not wired in for M1–M3. When added:

* Report summaries get a natural-language explanation of findings ("CSP is missing — this means...")
* Provider implementations (OpenAI, Anthropic, Ollama) live in `/shared/src/llm/providers/`
* If no provider is configured, the system produces raw JSON reports only
* This keeps the tool fully functional offline or without API keys

---

# Dev workflow

## `docker-compose.dev.yml` (override)

```yaml
services:
  controller:
    build:
      context: ../controller
      dockerfile: Dockerfile.dev
    volumes:
      - ../controller/src:/app/src
    command: npx tsx watch src/index.ts

  scanner:
    build:
      context: ../scanner
      dockerfile: Dockerfile.dev
    volumes:
      - ../scanner/src:/app/src
    command: npx tsx watch src/index.ts
```

Run with: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up`

This bind-mounts source for hot reload so you're not rebuilding images on every change.

---

# Test strategy

## Unit tests (critical path)

**Sanity check (`verifyPublicOnly`)** — most important code to test:

* `10.0.0.1` → restricted (RFC1918)
* `172.16.0.1` → restricted (RFC1918)
* `192.168.1.1` → restricted (RFC1918)
* `127.0.0.1` → restricted (loopback)
* `::1` → restricted (IPv6 loopback)
* `fe80::1` → restricted (IPv6 link-local)
* `fc00::1` → restricted (IPv6 ULA)
* `100.64.0.1` → restricted (CGNAT)
* `::ffff:192.168.1.1` → restricted (IPv4-mapped IPv6 → private)
* `::ffff:127.0.0.1` → restricted (IPv4-mapped IPv6 → loopback)
* `93.184.216.34` (example.com) → allowed (public)
* DNS returning zero results → error

## Unit tests (other)

* Command parser: all commands, unknown commands, extra whitespace
* Job state transitions: valid and invalid
* Schema validation: ScanRequest, JobPublic

## Integration tests

* Boot both services via compose, `POST /scan`, poll until `SUCCEEDED`, verify `headers.json` exists
* Start a job, kill scanner, restart, confirm `FAILED_ON_RESTART`
* `POST /scan` while a job is running → 429 with `runningJobId`
