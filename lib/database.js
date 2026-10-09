import pg from "pg";
import { attachDatabasePool } from "@vercel/functions";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

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

