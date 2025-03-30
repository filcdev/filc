import { exec } from "child_process";
import { promisify } from "util";

// resolve our schema to ../prisma/schema/schema.prisma
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { databaseConfig } from "@filc/config";
import { prisma } from "./client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const schemaPath = resolve(__dirname, "../prisma/schema");

const execPromise = promisify(exec);
const shouldRunMigrations = process.env.NODE_ENV !== "test" && process.env.NODE_ENV !== "development";

export const migrate = async () => {
  if (!shouldRunMigrations) {
    console.log("Skipping migrations in test/development environment");
    return;
  }

  console.log("Running migrations...");
  const { stderr, stdout } = await execPromise(`pnpm prisma db push --schema=${schemaPath}`, {
    env: {
      ...process.env,
      DATABASE_URL: databaseConfig.url,
    },
  });
  if (stderr) {
    console.error(`Error running migrations: ${stderr}`);
    throw new Error(`Migration failed: ${stderr}`);
  }
  if (stdout) {
    console.log(`Migrations output: ${stdout}`);
  }
  console.log("Migrations completed successfully");
}
