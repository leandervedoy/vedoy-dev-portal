import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [app, consoleScript, readme, openapi] = await Promise.all([
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../developer-console.js", import.meta.url), "utf8"),
  readFile(new URL("../README.md", import.meta.url), "utf8"),
  readFile(new URL("../openapi.yaml", import.meta.url), "utf8"),
]);

test("published examples use the production API and keep credentials as placeholders", () => {
  assert.match(app, /curl https:\/\/vedoy-dev-portal\.vercel\.app\/api\/v1\/health/);
  assert.match(app, /curl https:\/\/vedoy-dev-portal\.vercel\.app\/api\/v1\/models[\s\S]*Authorization: Bearer \$VEDOY_API_KEY/);
  assert.match(app, /process\.env\.VEDOY_API_KEY/);
  assert.match(app, /never put a project API key in browser JavaScript/i);
  assert.match(consoleScript, /Authorization: Bearer \$VEDOY_API_KEY/);
  assert.match(readme, /curl https:\/\/vedoy-dev-portal\.vercel\.app\/api\/v1\/health/);
  assert.match(readme, /Authorization: Bearer \$VEDOY_API_KEY/);
  assert.doesNotMatch(app, /vedoy-ai\.vercel\.app\/api\/v1/);
  assert.doesNotMatch(consoleScript, /Authorization: Bearer \$\{issuedApiKey/);
});

test("OpenAPI describes the public health route and the two implemented bearer schemes", () => {
  assert.match(openapi, /url: https:\/\/vedoy-dev-portal\.vercel\.app\/api/);
  assert.match(openapi, /\/v1\/health:[\s\S]*?security: \[\]/);
  assert.match(openapi, /bearerFormat: Supabase JWT/);
  assert.match(openapi, /bearerFormat: vdy_live_\.\.\./);
  assert.doesNotMatch(openapi, /\/v1\/chat\/completions|\/v1\/embeddings/);
});
