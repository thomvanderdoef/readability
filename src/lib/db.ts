import { Pool } from "pg";

let pool: Pool | undefined;

export function getPool() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const url = new URL(databaseUrl);
  const ssl =
    url.searchParams.get("sslmode") === "disable"
      ? false
      : {
          rejectUnauthorized: false,
        };

  pool ??= new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 30_000,
    ssl,
  });

  return pool;
}
