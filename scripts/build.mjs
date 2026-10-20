import { cp, mkdir } from "node:fs/promises";
import { build } from "esbuild";

const files = [
  "index.html",
  "admin.html",
  "admin.js",
  "styles.css",
  "room.css",
  "responsive.css",
  "public-apis.css",
  "public-apis.js",
  "app.js",
  "room-content.js",
  "auth.css",
  "beginner.css",
  "auth.js",
  "access.js",
  "developer-console.js",
  "supabase-config.js",
  "openapi.yaml",
];

await build({ entryPoints: ['room-scene.js'], outfile: 'assets/vendor/room.js', bundle: true, minify: true, format: 'esm', target: 'es2020', legalComments: 'linked' });
await build({ entryPoints: ['portal-motion.js'], outfile: 'assets/vendor/portal-motion.js', bundle: true, minify: true, format: 'esm', target: 'es2020', legalComments: 'linked' });

// Reuse the directory: replacing it can race with OneDrive sync on Windows.
await mkdir("public", { recursive: true });
await Promise.all(files.map(file => cp(file, `public/${file}`)));
await cp("assets", "public/assets", { recursive: true });
await cp("icons", "public/icons", { recursive: true });
