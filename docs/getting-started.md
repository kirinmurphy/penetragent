# Getting Started

## 1. Install and Test

Clone the repo (locally or on your VPS):

```bash
git clone <your-repo-url> penetragent
cd penetragent
```

Run the tests to verify everything works:

```bash
npm install
npm run build
npm test
```

Or selectively:

```bash
npm run test:unit
npm run test:integration
```

---

## 2. Deploy with Docker

Both local development and VPS production use Docker. The only difference is which command you run.

```bash
npm run docker:dev         # local — hot reload (uses cached images, FAST)
npm run docker:dev:build   # rebuild images when dependencies change
npm run docker:prod        # VPS — optimized multi-stage build, slim Node 20
```

**Use `docker:dev` for normal development** (just starts containers, takes seconds). Only use `docker:dev:build` when you've changed `package.json` or need to rebuild from scratch.

To stop:

```bash
npm run docker:down
```

### What runs where

- **Scanner** — listens on port 8080 inside the Docker network. Exposed to the host on `localhost:8080` for curl access. On a VPS, drop the `ports` mapping in `docker-compose.yml` if you don't need it.
- **Controller** — connects outbound to the Telegram API via long-polling. No inbound ports needed. Waits for the scanner's healthcheck to pass before starting.
- **Data** — SQLite database and scan reports are stored in a named Docker volume (`scanner-data`), so they persist across container restarts.

### Checking status

```bash
docker compose -f infra/docker-compose.yml logs -f
docker compose -f infra/docker-compose.yml ps
```

### Updating

```bash
git pull
npm run docker:dev    # or docker:prod on VPS
```

The scanner runs reconciliation on startup, so any jobs that were running when the old containers stopped get marked as `FAILED_ON_RESTART` automatically.

---

## 3. Using the Telegram Bot

The Telegram bot runs inside Docker (both `docker:dev` and `docker:prod`). You just need to provide credentials via a `.env` file before starting the containers.

### Get your Telegram credentials

You need two values: a **bot token** and your **user ID**.

**Create a bot:**

1. Open Telegram and search for **@BotFather**.
2. Send `/newbot`.
3. BotFather asks for a display name (e.g. "Penetragent") and a username (must end in `bot`, e.g. `penetragent_scanner_bot`).
4. Copy the token it gives you (looks like `123456789:ABCdefGhIjKlMnOpQrStUvWxYz`). This is your `TELEGRAM_BOT_TOKEN`.

**Get your user ID:**

1. Search for **@userinfobot** in Telegram and start a conversation.
2. It replies with your user ID (a number like `987654321`). This is your `TELEGRAM_ALLOWED_USER_ID`.

### Create your `.env` file

```bash
cp .env.example .env
```

Edit `.env` and fill in both values:

```
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIjKlMnOpQrStUvWxYz
TELEGRAM_ALLOWED_USER_ID=987654321
```

This file is gitignored and never committed.

### Optional scanner policy mode settings

By default, scanner outbound policy runs in `external-safe` mode.

```
SCAN_POLICY_MODE=external-safe
INTERNAL_ASSESSMENT_DISABLED=false
OUTBOUND_EGRESS_DISABLED=false
OUTBOUND_AUDIT_LOG_LEVEL=deny
INTERNAL_ALLOWED_HOST_PATTERNS=
INTERNAL_ALLOWED_PORTS=80,443
INTERNAL_ALLOW_PRIVATE_IPS=false
```

Use `SCAN_POLICY_MODE=internal-assessment` only for explicitly authorized client scopes.  
When using internal mode, set `INTERNAL_ALLOWED_HOST_PATTERNS` and `INTERNAL_ALLOWED_PORTS` to the smallest possible allowlist.
Set `INTERNAL_ASSESSMENT_DISABLED=true` as an emergency kill-switch to force the scanner back to `external-safe` behavior.
Set `OUTBOUND_EGRESS_DISABLED=true` as an emergency kill-switch to block all outbound scan traffic immediately.
Set `OUTBOUND_AUDIT_LOG_LEVEL=deny` (default) to log denied outbound attempts only, or `all` to log both allowed and denied decisions.

### Operator quickstart

Normal safe operation:

- `SCAN_POLICY_MODE=external-safe`
- `OUTBOUND_EGRESS_DISABLED=false`
- `INTERNAL_ASSESSMENT_DISABLED=false`
- `OUTBOUND_AUDIT_LOG_LEVEL=deny`

Internal client assessment (authorized scope only):

- `SCAN_POLICY_MODE=internal-assessment`
- `INTERNAL_ALLOWED_HOST_PATTERNS=<approved hosts>`
- `INTERNAL_ALLOWED_PORTS=<approved ports>`
- `INTERNAL_ALLOW_PRIVATE_IPS=true` only when explicitly authorized

Emergency stop:

- Set `OUTBOUND_EGRESS_DISABLED=true`
- Restart scanner and verify `/health` shows `outboundEgressDisabled: true`

### Start and use

Start (or restart) the Docker containers — the controller picks up the `.env` automatically:

```bash
npm run docker:dev    # local
npm run docker:prod   # VPS
```

Now DM your bot in Telegram: `help`, `scan https://example.com`, `history`, etc.

When a scan completes, the bot sends you a self-contained HTML report as a downloadable document — including summary cards, issue details with remediation guidance, and a printable resolution checklist.

### Telegram commands

| Command                         | Description                              |
| ------------------------------- | ---------------------------------------- |
| `help`                          | Show available commands                  |
| `targets`                       | List previously scanned targets          |
| `scantypes`                     | List available scan types                |
| `scan <url> [type]`             | Run a security scan (http, tls, or all)  |
| `status <jobId>`                | Check the status of a scan job           |
| `history [target\|number]`      | Show scan history                        |
| `delete <identifier\|all>`      | Delete scans (requires confirmation)     |
| `confirm`                       | Confirm pending deletion                 |

**Examples:**

```text
help
scan https://example.com                              # runs all scan types (http + tls)
scan https://example.com http                         # HTTP analysis only
scan https://example.com tls                          # SSL/TLS analysis only
status a1b2c3d4-e5f6-7890-abcd-ef1234567890
targets
scantypes
history                                               # last 10 unique targets
history 25                                            # last 25 unique targets
history example.com                                   # all scans for target
delete example.com                                    # delete all scans for target
confirm                                               # confirm deletion
```

**Scan types:**
- `http` — Crawls up to 20 pages, grades security headers, checks cookies, scripts, and CORS
- `tls` — Analyzes SSL certificates, protocol versions, and cipher suites
- Default (no type specified) — Runs both `http` and `tls`

---

## 4. Running Locally without Docker

If you prefer to run the scanner process directly without Docker. Useful for debugging or if you don't have Docker installed.

### Install, build, and start

```bash
npm install
npm run build
cd scanner && npx tsx src/index.ts
```

You should see:

```
Migrated
Worker started: <uuid>
Server listening on 0.0.0.0:8080
```

The scanner is now available at `localhost:8080` for curl commands (see section 5 below).

---

## 5. Using curl Directly

The scanner exposes an HTTP API on port 8080. This works whether you're running locally with Docker, on a VPS (SSH in first), or running the scanner without Docker.

```bash
# Health check
curl localhost:8080/health

# Scan any public URL (defaults to running all scan types)
curl -X POST localhost:8080/scan \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","requestedBy":"cli"}'

# Specify scan type explicitly
curl -X POST localhost:8080/scan \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","scanType":"http","requestedBy":"cli"}'
```

The response includes a `jobId`. The job moves through `QUEUED → RUNNING → SUCCEEDED` within a few seconds to a minute depending on the scan type and site size.

```bash
# Check job status (paste your jobId)
curl localhost:8080/jobs/<jobId>

# List all jobs
curl localhost:8080/jobs

# List previously scanned targets
curl localhost:8080/targets

# Download the HTML report
curl localhost:8080/reports/<jobId>/html > report.html
```

When you pass a `url`, the scanner auto-registers it as a target using the hostname. You can also re-scan a previously scanned target by passing `targetId` instead of `url`:

```bash
curl -X POST localhost:8080/scan \
  -H 'Content-Type: application/json' \
  -d '{"targetId":"example.com","requestedBy":"cli"}'
```

Reports are generated in the `scanner/reports/<jobId>/` directory as both JSON and HTML.

### Full curl API

| Method   | Endpoint                          | Description                     |
| -------- | --------------------------------- | ------------------------------- |
| `GET`    | `/health`                         | Health check                    |
| `GET`    | `/targets`                        | List previously scanned targets |
| `POST`   | `/scan`                           | Start a scan                    |
| `GET`    | `/jobs/<jobId>`                   | Check job status                |
| `GET`    | `/jobs?limit=10&offset=0`         | List jobs (paginated)           |
| `GET`    | `/jobs?targetId=example.com`      | List jobs for specific target   |
| `GET`    | `/reports/<jobId>/html`           | Download HTML report            |
| `GET`    | `/reports/<jobId>/json`           | Download JSON report            |
| `DELETE` | `/jobs/<jobId>`                   | Delete single job               |
| `DELETE` | `/jobs?targetId=example.com`      | Delete all jobs for target      |
| `DELETE` | `/jobs/all`                       | Delete all jobs                 |
