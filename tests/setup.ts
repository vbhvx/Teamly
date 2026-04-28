import * as dotenv from "dotenv";
import { beforeAll, afterAll } from "vitest";
import { runMigrations } from "@/db/migrate";
import { pool } from "@/db/client";

dotenv.config({ path: ".env" });
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
const testDbUrl = process.env.DATABASE_TEST_URL || process.env.DATABASE_URL;

if (!testDbUrl) {
  throw new Error("DATABASE_TEST_URL or DATABASE_URL must be defined for running test suite");
}

beforeAll(async () => {
  // Ensure migrations are up to date on test DB
  await runMigrations(testDbUrl);
});

afterAll(async () => {
  await pool.end();
});
