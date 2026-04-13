import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString =
  process.env.NODE_ENV === "test"
    ? process.env.DATABASE_TEST_URL || process.env.DATABASE_URL
    : process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL or DATABASE_TEST_URL is not defined in environment variables");
}

export const pool = new Pool({
  connectionString,
  max: process.env.NODE_ENV === "test" ? 5 : 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool, { schema });

export async function closePool(): Promise<void> {
  await pool.end();
}

