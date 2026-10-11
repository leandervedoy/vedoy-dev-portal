import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ||= "postgresql://localhost/vedoy_test";
const { default: handler } = await import("../api/[...path].js");

async function callHealthOptions(origin) {
  const headers = new Map();
  const response = {
    statusCode: 0,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    end() {},
  };
  await handler({
    method: "OPTIONS",
    url: "/api/v1/health",
    headers: { origin },
  }, response);
  return { statusCode: response.statusCode, headers };
}

test("health preflight allows only the Phone production origin and read-only methods", async () => {
  const { statusCode, headers } = await callHealthOptions("https://vedoy-phone.vercel.app");
  assert.equal(statusCode, 204);
  assert.equal(headers.get("access-control-allow-origin"), "https://vedoy-phone.vercel.app");
  assert.equal(headers.get("access-control-allow-methods"), "GET, OPTIONS");
  assert.equal(headers.get("access-control-allow-headers"), "Accept, Content-Type");
  assert.equal(headers.get("vary"), "Origin");
});

test("health preflight does not grant CORS access to other origins", async () => {
  const { headers } = await callHealthOptions("https://example.com");
  assert.equal(headers.has("access-control-allow-origin"), false);
  assert.equal(headers.has("access-control-allow-methods"), false);
});
