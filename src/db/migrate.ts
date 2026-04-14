import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

export async function runMigrations(targetUrl?: string) {
  const url = targetUrl || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL must be specified in the environment or passed as an argument");
  }
  const migrationPool = new Pool({ connectionString: url, max: 1 });
  const migrationDb = drizzle(migrationPool);

  console.log(`Running migrations against: ${url.replace(/:[^:@]*@/, ":****@")}`);
  await migrate(migrationDb, { migrationsFolder: "./src/db/migrations" });
  await migrationPool.end();
  console.log("Migrations applied successfully.");
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}

