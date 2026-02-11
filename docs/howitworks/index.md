# How It Works

Architecture and flow diagrams for the Penetragent pentest agent.

1. [Monorepo Structure](./01-monorepo-structure.md) — Package layout and dependency graph
2. [Scan Workflow](./02-scan-workflow.md) — End-to-end sequence from Telegram command to result, plus job state machine
3. [SSRF Prevention](./03-ssrf-prevention.md) — DNS resolution and IP range validation gate
4. [Headers Grading](./04-headers-grading.md) — How each security header is evaluated (good/weak/missing)
5. [Database Schema](./05-database-schema.md) — SQLite entity-relationship diagram
6. [Worker Lifecycle](./06-worker-lifecycle.md) — Startup, heartbeat, polling loop, and crash recovery
7. [Telegram Commands](./07-telegram-commands.md) — Message routing through allowlist, parser, and command handlers
8. [Docker Architecture](./08-docker-architecture.md) — Container networking and volume layout
9. [Job Poller Flow](./09-job-poller-flow.md) — Fire-and-forget async polling pattern
