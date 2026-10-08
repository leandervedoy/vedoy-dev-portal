import { cp, mkdir, rm } from "node:fs/promises";

const files = [
  "index.html",
  "styles.css",
  "app.js",
  "auth.css",
  "auth.js",
  "access.js",
  "developer-console.js",
  "supabase-config.js",
  "openapi.yaml",
];

await rm("public", { recursive: true, force: true });
await mkdir("public", { recursive: true });
await Promise.all(files.map(file => cp(file, `public/${file}`)));
await cp("assets", "public/assets", { recursive: true });
