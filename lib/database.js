import pg from "pg";
import { attachDatabasePool } from "@vercel/functions";

const { Pool } = pg;

// Supabase becomes primary when its server-only connection is configured.
// Do not silently fail over writes: the reserve may contain older data.
const connectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
export const databaseProvider = process.env.SUPABASE_DATABASE_URL ? 'supabase' : (process.env.DATABASE_PROVIDER || 'postgresql');

if (!connectionString) {
  throw new Error("DATABASE_URL is required. Configure a pooled PostgreSQL connection.");
}

const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false },
});

attachDatabasePool(pool);

export function query(text, values = []) {
  return pool.query(text, values);
}

export async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

