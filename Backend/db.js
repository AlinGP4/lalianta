import pg from "pg";

const { Pool } = pg;

const globalForPostgres = globalThis;

function createPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : false,
  });
}

export function getDb() {
  if (!globalForPostgres.__laliantaDbPool) {
    globalForPostgres.__laliantaDbPool = createPool();
  }

  return globalForPostgres.__laliantaDbPool;
}

export async function query(text, params = []) {
  return getDb().query(text, params);
}

export async function checkDatabaseConnection() {
  const result = await query("select now() as now");
  return result.rows[0];
}
