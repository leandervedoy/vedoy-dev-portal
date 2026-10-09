import { readFile } from "node:fs/promises";
import pg from "pg";

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DATABASE_URL_UNPOOLED or DATABASE_URL before running migrations.");

const migrations = [
  "001_developer_platform.sql",
  "002_telnyx_commerce.sql",
];
const client = new pg.Client({
  connectionString,
  ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false },
});

await client.connect();
try {
  for (const migration of migrations) {
    const sql = await readFile(new URL(`../migrations/${migration}`, import.meta.url), "utf8");
    await client.query(sql);
    console.log(`Applied ${migration}.`);
  }
  console.log("Developer platform migration completed.");
} finally {
  await client.end();
}
