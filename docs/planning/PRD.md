## PRD v1.3: Tool-capped public-URL pentest agent

### 1) Overview

Build a DM-controlled automation tool that runs **authorized, non-destructive security checks** against **only** your allowlisted **public URLs**, from an isolated Docker deployment you can run locally and later deploy to a DigitalOcean droplet.

This is intentionally **not** a general AI agent. It's a constrained, job-based automation tool with hard technical boundaries.

---

### 2) Problem

You want a repeatable way to test what a malicious public user can do to your applications, without:

* exposing a UI via Traefik or opening inbound ports,
* giving the tool access to your personal accounts,
* allowing it to scan anything outside your own properties.

---

### 3) Goals

* **DM-only control** via Telegram; only you can issue commands.
* **Public URLs only**: scan the same URLs a public user hits (through Cloudflare/Traefik if present).
* **Tool-capped behavior**: only a small set of explicit actions (start scan, check status, deliver report).
* **Flexible scope control**: scan by `targetId` (pre-registered allowlist) or by direct `url` (auto-registered as an ad-hoc target using the hostname). The SSRF sanity check enforces public-only regardless of how the target was specified.
* **Model-agnostic design**: core scan/job machinery is deterministic with no LLM dependency. Optional LLM enrichment (report summarization, finding analysis) sits behind a provider interface so you can swap models (OpenAI, Anthropic, Ollama, etc.) or run fully offline.
* **Learning-first implementation**: milestones that teach agent fundamentals (interfaces, tools, policies, job state, isolation, ops).

---

### 4) Non-goals (v1)

* Scanning internal service names, private Docker networks, or origins directly.
* Destructive/active exploitation.
* General browsing, arbitrary shell commands, or arbitrary filesystem access beyond report storage.
* Multi-user support.

---

### 5) Primary user + usage model

* **Single operator (you)** using Telegram DMs.
* Tool runs as two services in Docker on your laptop (dev) and later on the droplet (prod).

---

### 6) Functional requirements

#### 6.1 Commands (DM-only)

* `help`
* `targets` — list allowed targets
* `scantypes` — list available scan types
* `scan <targetId> <scanType>` — create a job and start scan
* `status <jobId>` — job status
* `history [n]` — recent jobs (optional but recommended)

#### 6.2 Targets

Targets can be specified two ways:

* **By ID (pre-registered)**: `targetId` maps to a fixed URL in the database, e.g. `staging` → `https://staging.example.com`. Seeded at startup or added via future API.
* **By URL (ad-hoc)**: A `url` field can be passed directly to `POST /scan`. The scanner auto-registers it as a target using the hostname as the ID, so re-scanning the same domain reuses the record.

In both cases, the SSRF sanity check (Resolve→Normalize→Verify) runs before any outbound HTTP request. The safety boundary is the DNS/IP check, not the target allowlist.

#### 6.3 Scan Types (code-based, not database)

Scan types are defined in code (`shared/src/types.ts`) and dispatched by the scanner. Start with two scan types:

1. `headers` (M3) — fetch + record TLS / redirects / security headers; no crawl.
2. `crawl` (M4) — passive crawl + passive checks (no "attacks").

If using OWASP ZAP crawl scan, it runs a spider then passive scanning and explicitly does not perform actual attacks.

#### 6.4 Job model + long-running scans

* `scan` must respond immediately with:

  * `jobId`
  * initial status (`QUEUED` or `RUNNING`)
* Controller must not "hang" waiting for completion. It must poll in the background and message you on completion.
* Scans may run 10–20 minutes (or more) depending on site size; the system must tolerate long jobs.

#### 6.5 Report delivery

* Primary MVP: zip artifacts and send as a Telegram document.
* Telegram Bot API standard upload limit for bots is **50MB**.
* If the report zip exceeds 50MB:

  * DM summary only (v1),
  * mark job as `COMPLETED_WITH_ARTIFACT_LIMIT`,
  * still apply retention/cleanup.

---

### 7) Non-functional requirements

#### 7.1 Isolation & networking

* No inbound ports required (Telegram long-polling).
* Controller and scanner run on a private Docker network.
* Neither service attaches to your existing proxy/app networks.

#### 7.2 Performance & resource controls

* Concurrency limit (v1: 1 job at a time, configurable later).
* Timeouts per profile (scan max runtime).
* Container CPU/memory limits.

#### 7.3 Observability

* Structured logs for:

  * command received (operator id, command type)
  * job lifecycle transitions
  * sanity-check results (see below)
  * scan start/end + duration
* Job status persisted in DB.

#### 7.4 Retention & disk safety

* Enforce retention policy:

  * keep last N jobs or last N days
  * max disk budget for `/reports` with fail-safe
* Cleanup runs automatically (e.g., on startup and/or scheduled interval).

#### 7.5 Crash tolerance / "zombie job" handling

* If the scanner crashes mid-job, jobs must not remain stuck in `RUNNING`.
* On scanner startup, perform reconciliation:

  * any `RUNNING` job without an active worker/lease is marked `FAILED_ON_RESTART`.

---

### 8) Security requirements (hard constraints)

#### 8.1 Input validation

* `scanType` must exist in the SCAN_TYPES constant (code-based validation).
* Targets are resolved one of two ways:
  * `targetId` must exist in the targets table, OR
  * `url` must be a valid URL (auto-registered as an ad-hoc target).
  * At least one of `targetId` or `url` must be provided.
* The primary safety boundary is **not** the target allowlist — it's the DNS/IP sanity check that runs before any outbound HTTP request.

#### 8.2 Public-only hard boundary: "Resolve → Verify → Normalize → Log & Abort"

Before any scan starts, the scanner must:

1. **Resolve**
   Resolve the target hostname (A and AAAA), producing a list of resolved IPs.

2. **Normalize**
   Normalize and classify resolved addresses, including:

   * IPv4-mapped IPv6 addresses (e.g., `::ffff:7f00:1` / `::ffff:127.0.0.1`)
   * Ensure the range checks apply to the normalized form.

3. **Verify**
   If *any* resolved IP is restricted, fail closed. At minimum:

   * Private IPv4 ranges per RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`.
   * Loopback: `127.0.0.0/8`
   * Recommended additional restricted ranges:

     * IPv4 link-local: `169.254.0.0/16`
     * IPv4 CGNAT: `100.64.0.0/10`
     * IPv6 loopback: `::1`
     * IPv6 link-local: `fe80::/10`
     * IPv6 ULA: `fc00::/7`

4. **Log & Abort**
   If restricted:

   * log hostname + resolved IP list
   * mark job failed with `PRIVATE_RANGE_RESTRICTED`
   * do not attempt any HTTP request

This makes "public-only" enforceable even under split-horizon DNS or misconfig.

#### 8.3 Tool cap (capability boundaries)

* Controller can:

  * parse Telegram commands
  * create/poll jobs
  * package and send reports
* Scanner can:

  * accept scan jobs via internal API
  * run defined scan types (dispatched from code-based SCAN_TYPES constant)
  * write artifacts to the reports volume
  * maintain job heartbeat/lease
* No generic "run shell" or arbitrary network tool is exposed via DM commands.

#### 8.4 Defense-in-depth (planned)

* Egress allowlisting (Milestone M8): scanner outbound restricted to allowlisted public targets.
* Optional future: local Telegram Bot API server to allow larger uploads (up to 2000MB).

---

# Technical spec (v1.3 scope)

### 9) Architecture

Two-service design on a private network:

1. **Controller (Telegram DM interface)**

* Telegram long-polling
* allowlist operator by Telegram user id
* creates scan jobs
* background polling for job completion
* sends summary + artifacts via Telegram

2. **Scanner (scan runner)**

* internal HTTP API (only reachable on private Docker network)
* executes scan profiles
* performs Resolve→Normalize→Verify sanity check
* writes artifacts + summary
* maintains job heartbeat/lease and reconciliation on restart

Storage:

* SQLite for job metadata
* Docker volume for `/reports`

---

### 10) Repo layout

Monorepo structure (share types/schemas):

* `/controller`
* `/scanner`
* `/shared` (types + validation schemas)
* `/data` (mounted volume)
* `/reports` (mounted volume)
* `docker-compose.yml`

---

### 11) Data model (minimal)

* `targets(id, base_url, enabled)`
* `jobs(`
  `id, requested_by, target_id, scan_type, status, status_reason, error_code,`
  `attempt, worker_id, last_heartbeat_at,`
  `created_at, started_at, finished_at,`
  `resolved_ips_json, report_path, summary_json`
  `)`

Note: Scan types are defined in code (`SCAN_TYPES` constant in `shared/src/types.ts`), not in a database table.

---

### 12) Scanner API

* `POST /scan` → `{ targetId?, url?, scanType, requestedBy }` → `{ jobId, status, ... }`
  * Provide `targetId` to scan a pre-registered target, or `url` to scan any public URL (at least one required).
  * Returns 201 with full job object on success.
  * Returns 429 with `{ error: "RATE_LIMITED", runningJobId }` if a job is already running.
  * Returns 404 if `targetId` not found or 400 if `scanType` is invalid.
* `GET /jobs/:jobId` → full job object (status, summary, errors, resolved IPs, timestamps)
* `GET /jobs?limit=N&offset=0` → paginated job list

---

### 13) Job lifecycle requirements

* When a job starts:

  * set `status=RUNNING`, set `worker_id`, set `last_heartbeat_at=now`
* While running:

  * update `last_heartbeat_at` periodically
* On startup:

  * any job with `status=RUNNING` and stale/missing heartbeat is marked `FAILED_ON_RESTART`

---

### 14) Report packaging + Telegram delivery logic

* On completion:

  * zip `/reports/<jobId>/` → `/reports/<jobId>.zip`
  * if zip ≤ 50MB → send as document
  * else → send summary only + mark `COMPLETED_WITH_ARTIFACT_LIMIT`
* Always apply cleanup policy.

---

### 15) Prerequisites

* **Telegram bot**: create via BotFather, save token. Get your numeric user ID (message @userinfobot or similar).
* **Colima**: Docker runtime. Named volumes work as-is. Ensure `docker context` is set to colima or `DOCKER_HOST` points to `~/.colima/default/docker.sock`.
* **`.env`**: repo root `.env` with `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ALLOWED_USER_ID`. A `.env.example` is provided as a template.

### 16) Dev workflow

* `docker-compose.dev.yml` override with bind-mounted source and hot reload (e.g. `tsx --watch`) so you're not rebuilding images on every change.
* Scanner and controller each have their own `Dockerfile` (prod) and the dev override mounts local source over the built image.

### 17) Test strategy

* **Unit tests (80 total):**
  * Sanity check (17 tests) — IPv4 private ranges, IPv6 ULA/loopback/link-local, IPv4-mapped IPv6, CGNAT, public IPs, dual-stack, mixed, empty results.
  * Headers grading (26 tests) — every grading function with isolated string inputs.
  * Job service (9 tests) — state transitions, pagination, reconciliation.
  * Schema validation (16 tests) — ScanRequest (targetId, url, both, neither), JobPublic, JobListQuery.
  * Command parser (12 tests) — valid commands, `/` prefix, case, whitespace, unknown.
* **Integration tests (49 total):**
  * Scanner API (9 tests) — health, POST /scan, GET /jobs, 404s, rate limiting, full scan flow with worker.
  * Reconciliation (3 tests) — stale jobs marked FAILED_ON_RESTART, fresh jobs untouched, multiple stale.
  * Headers scan end-to-end (37 tests) — real Fastify servers with specific header configurations. Every grading outcome for every header (HSTS: 5, CSP: 5, XCTO: 3, XFO: 4, RP: 4, PP: 2), info leakage (4), redirect chains (4), summary counts (4), report artifacts (2).

---

## Milestones (learning-first)

### M0 — Threat model + scope contract

**Learn:** tool cap boundaries, threat modeling, "fail closed" policies.
**Deliverables:** 1-page threat model, targets/profiles allowlists.

### M1 — Telegram controller + command grammar

**Learn:** deterministic command parsing, operator allowlisting, async UX.
**Deliverables:** `help/targets/profiles/scan/status` with immediate `jobId` response.

### M2 — Job state machine + SQLite persistence

**Learn:** orchestration, idempotency, restarts, zombie-job prevention.
**Deliverables:** statuses, heartbeat fields, reconciliation rules, `history`.

### M3 — Scanner service + `headers` scan type + public-only sanity check

**Learn:** narrow tool API design, safe defaults, artifact production, SSRF prevention via DNS resolution.
**Deliverables:** headers checks, `summary.json`, artifacts, persisted job state. Resolve→Normalize→Verify→Log&Abort sanity check enforced before any outbound HTTP request. IPv4, IPv6, and IPv4-mapped IPv6 regression tests.

### M4 — `crawl` passive scan type integration

**Learn:** integrating an external scanner behind policy constraints.
**Deliverables:** crawl scan artifacts + summary; no "attacks." Add `crawl` to `SCAN_TYPES` constant and implement dispatcher logic.

### M5 — Report delivery + retention + disk guardrails

**Learn:** artifact management, backpressure, operational limits.
**Deliverables:** zip + send; summary-only fallback at 50MB; cleanup enforced.

### M6 — LLM-powered report enrichment (model-agnostic)

**Learn:** LLM integration patterns, provider abstraction, prompt engineering for security analysis.
**Deliverables:** `LlmProvider` interface behind which any model can sit (OpenAI, Anthropic, Ollama for local/offline). Enriched report summaries that explain what each finding means and why it matters. System works fully without an LLM configured (raw JSON reports still produced).

### M7 — Droplet-ready isolation + hardening

**Learn:** least privilege in Docker, network segmentation.
**Deliverables:** private network only, no ports exposed, non-root, cap-drop, minimal mounts.

### M8 — Egress allowlisting

**Learn:** defense-in-depth beyond code checks.
**Deliverables:** scanner egress restricted to allowlisted targets; validate by attempting to reach a non-allowlisted domain and confirming failure.
