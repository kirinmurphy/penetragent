import type Database from "better-sqlite3";
import type { ScannerConfig } from "@penetragent/shared";

declare module "fastify" {
  interface FastifyInstance {
    db: Database.Database;
    config: ScannerConfig;
  }
}
