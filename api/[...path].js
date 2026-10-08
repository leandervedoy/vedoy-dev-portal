import { createHash, randomBytes } from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://niedmgyyougvgiiuwcvw.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_7PrmP1V4enFECw0jfTAiDw_XAXD-xqd";
const API_VERSION = "2026-10-08";

function send(res, status, payload, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Vedoy-API-Version", API_VERSION);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type,Idempotency-Key");
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(payload));
}

async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("Request body must be valid JSON."), { status: 400, code: "invalid_json" }); }
}

function bearer(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

async function supabase(path, { token = SUPABASE_KEY, method = "GET", payload, query, prefer } = {}) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`);
  Object.entries(query || {}).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || data?.hint || "Database request failed.");
    error.status = response.status;
    error.code = data?.code || "database_error";
    throw error;
  }
  return data;
}

function requireUser(req) {
  const token = bearer(req);
  if (!token || token.startsWith("vdy_")) {
    throw Object.assign(new Error("A signed-in Vedøy account is required."), { status: 401, code: "user_auth_required" });
  }
  return token;
}

async function authorizeApiKey(req, route, costMicrounits = 0) {
  const token = bearer(req);
  if (!token.startsWith("vdy_")) {
    throw Object.assign(new Error("Provide a Vedøy API key as a Bearer token."), { status: 401, code: "api_key_required" });
  }
  const rows = await supabase("rpc/developer_authorize_api_key", {
    method: "POST",
    payload: {
      p_api_key: token,
      p_route: route,
      p_method: req.method,
      p_cost_microunits: costMicrounits,
      p_idempotency_key: req.headers["idempotency-key"] || null,
    },
  });
  const result = rows?.[0];
  if (!result?.allowed) {
    const status = result?.reason === "rate_limit_exceeded" ? 429 : result?.reason === "insufficient_credits" ? 402 : 401;
    throw Object.assign(new Error(result?.reason || "API key authorization failed."), {
      status,
      code: result?.reason || "invalid_api_key",
      retryAfter: result?.retry_after_seconds,
    });
  }
  return result;
}

function routePath(req) {
  const url = new URL(req.url, "https://portal.local");
  return url.pathname.replace(/^\/api/, "") || "/";
}

export default async function handler(req, res) {
  const path = routePath(req);
  try {
    if (req.method === "OPTIONS") return send(res, 204, {});
    if (req.method === "GET" && (path === "/" || path === "/v1/health")) {
      return send(res, 200, {
        ok: true,
        service: "vedoy-developer-api",
        version: API_VERSION,
        database: "connected-via-supabase-data-api",
        docs: "/openapi.yaml",
      });
    }
    if (req.method === "GET" && path === "/v1/projects") {
      const token = requireUser(req);
      const projects = await supabase("developer_projects", {
        token,
        query: { select: "id,name,slug,status,rate_limit_per_minute,created_at", order: "created_at.desc" },
      });
      return send(res, 200, { data: projects });
    }
    if (req.method === "POST" && path === "/v1/projects") {
      const token = requireUser(req);
      const input = await body(req);
      if (!input.name || String(input.name).trim().length < 2) {
        return send(res, 422, { error: { code: "invalid_name", message: "Project name must contain at least two characters." } });
      }
      const slug = String(input.slug || input.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
      const projects = await supabase("developer_projects", {
        token,
        method: "POST",
        prefer: "return=representation",
        payload: { name: String(input.name).trim(), slug },
      });
      return send(res, 201, { data: projects?.[0] });
    }
    const apiKeyMatch = path.match(/^\/v1\/projects\/([0-9a-f-]+)\/api-keys$/i);
    if (req.method === "POST" && apiKeyMatch) {
      const token = requireUser(req);
      const input = await body(req);
      const rawKey = `vdy_live_${randomBytes(24).toString("base64url")}`;
      const keyHash = createHash("sha256").update(rawKey).digest("hex");
      const prefix = rawKey.slice(0, 17);
      const rows = await supabase("developer_api_keys", {
        token,
        method: "POST",
        prefer: "return=representation",
        payload: {
          project_id: apiKeyMatch[1],
          name: String(input.name || "Default key").trim().slice(0, 80),
          key_prefix: prefix,
          key_hash: keyHash,
        },
      });
      return send(res, 201, { data: { ...rows?.[0], key: rawKey }, warning: "Copy this key now. It will not be shown again." });
    }
    if (req.method === "GET" && path === "/v1/usage") {
      const token = requireUser(req);
      const events = await supabase("developer_usage_events", {
        token,
        query: { select: "id,project_id,route,method,status_code,cost_microunits,created_at", order: "created_at.desc", limit: "100" },
      });
      return send(res, 200, { data: events });
    }
    if (req.method === "GET" && path === "/v1/credits/balance") {
      const token = requireUser(req);
      const wallets = await supabase("developer_wallet_balances", {
        token,
        query: { select: "project_id,balance_microunits,updated_at" },
      });
      return send(res, 200, { data: wallets });
    }
    if (req.method === "GET" && path === "/v1/models") {
      const auth = await authorizeApiKey(req, path, 0);
      return send(res, 200, {
        data: [
          { id: "vedoy/openai", type: "text", status: "preview" },
          { id: "vedoy/router", type: "text", status: "planned" },
        ],
        projectId: auth.project_id,
      }, { "X-RateLimit-Remaining": String(auth.remaining_requests) });
    }
    if (path.startsWith("/v1/")) {
      return send(res, 501, {
        error: {
          code: "capability_not_configured",
          message: "This API contract is documented, but its provider-backed implementation is not enabled yet.",
        },
      });
    }
    return send(res, 404, { error: { code: "not_found", message: "Route not found." } });
  } catch (error) {
    const headers = error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {};
    return send(res, error.status || 500, {
      error: {
        code: error.code || "internal_error",
        message: error.status && error.status < 500 ? error.message : "The API could not complete the request.",
      },
    }, headers);
  }
}
