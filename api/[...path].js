import { createHash, randomBytes } from "node:crypto";
import { query, transaction } from "../lib/database.js";
import { deliverWebhook, emitWebhookEvent, webhookEndpointSecret } from "../lib/webhooks.js";
import {
  normalizeAvailableNumber,
  pricingConfiguration,
  retailMicros,
  telnyxConfigured,
  telnyxRequest,
  usdToCreditsMicrounits,
} from "../lib/telnyx.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://niedmgyyougvgiiuwcvw.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_7PrmP1V4enFECw0jfTAiDw_XAXD-xqd";
const API_VERSION = "2026-10-09";

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

async function requireUser(req) {
  const token = bearer(req);
  if (!token || token.startsWith("vdy_")) {
    throw Object.assign(new Error("A signed-in Vedøy account is required."), { status: 401, code: "user_auth_required" });
  }
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
  });
  const user = await response.json().catch(() => null);
  if (!response.ok || !user?.id) {
    throw Object.assign(new Error("The user session is invalid or expired."), { status: 401, code: "invalid_user_session" });
  }
  return user;
}

async function authorizeApiKey(req, route, costMicrounits = 0) {
  const token = bearer(req);
  if (!token.startsWith("vdy_")) {
    throw Object.assign(new Error("Provide a Vedøy API key as a Bearer token."), { status: 401, code: "api_key_required" });
  }
  const keyHash = createHash("sha256").update(token).digest("hex");
  const idempotencyKey = req.headers["idempotency-key"] || null;

  const result = await transaction(async (client) => {
    const keyResult = await client.query(
      `select k.id as api_key_id, k.project_id, p.rate_limit_per_minute
       from developer_api_keys k join developer_projects p on p.id = k.project_id
       where k.key_hash = $1 and k.revoked_at is null
         and (k.expires_at is null or k.expires_at > now()) and p.status = 'active'
       for update of k`,
      [keyHash],
    );
    const key = keyResult.rows[0];
    if (!key) return { allowed: false, reason: "invalid_api_key" };
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [key.project_id]);

    if (idempotencyKey) {
      const prior = await client.query(
        "select id from developer_usage_events where project_id = $1 and idempotency_key = $2 limit 1",
        [key.project_id, idempotencyKey],
      );
      if (prior.rowCount) {
        const balance = await client.query("select balance_microunits from developer_wallet_balances where project_id = $1", [key.project_id]);
        return { allowed: true, reason: "idempotent_replay", project_id: key.project_id, remaining_requests: key.rate_limit_per_minute, balance_microunits: balance.rows[0]?.balance_microunits || 0 };
      }
    }

    const countResult = await client.query(
      "select count(*)::integer as count from developer_usage_events where project_id = $1 and created_at >= date_trunc('minute', now())",
      [key.project_id],
    );
    const requestCount = countResult.rows[0].count;
    if (requestCount >= key.rate_limit_per_minute) {
      const retry = await client.query("select greatest(1, extract(seconds from (date_trunc('minute', now()) + interval '1 minute' - now()))::integer) as seconds");
      return { allowed: false, reason: "rate_limit_exceeded", retry_after_seconds: retry.rows[0].seconds };
    }

    const balanceResult = await client.query("select coalesce(balance_microunits, 0)::bigint as balance_microunits from developer_wallet_balances where project_id = $1", [key.project_id]);
    const balance = Number(balanceResult.rows[0]?.balance_microunits || 0);
    if (costMicrounits > balance) return { allowed: false, reason: "insufficient_credits" };

    await client.query(
      `insert into developer_usage_events (project_id, api_key_id, route, method, cost_microunits, idempotency_key)
       values ($1, $2, $3, $4, $5, $6)`,
      [key.project_id, key.api_key_id, route.slice(0, 300), req.method.slice(0, 12).toUpperCase(), costMicrounits, idempotencyKey],
    );
    if (costMicrounits > 0) {
      await client.query(
        `insert into developer_ledger_entries (project_id, amount_microunits, entry_type, description, idempotency_key, metadata)
         values ($1, $2, 'usage', $3, $4, $5::jsonb)`,
        [key.project_id, -costMicrounits, `API usage: ${route.slice(0, 200)}`, idempotencyKey, JSON.stringify({ route, method: req.method })],
      );
    }
    await client.query("update developer_api_keys set last_used_at = now() where id = $1", [key.api_key_id]);
    return { allowed: true, reason: "ok", project_id: key.project_id, api_key_id: key.api_key_id, remaining_requests: Math.max(0, key.rate_limit_per_minute - requestCount - 1), balance_microunits: balance - costMicrounits };
  });

  if (!result.allowed) {
    const status = result.reason === "rate_limit_exceeded" ? 429 : result.reason === "insufficient_credits" ? 402 : 401;
    throw Object.assign(new Error(result.reason || "API key authorization failed."), { status, code: result.reason || "invalid_api_key", retryAfter: result.retry_after_seconds });
  }
  return result;
}

function routePath(req) {
  const url = new URL(req.url, "https://portal.local");
  return url.pathname.replace(/^\/api/, "") || "/";
}

function requestUrl(req) {
  return new URL(req.url, "https://portal.local");
}

function requireIdempotencyKey(req) {
  const value = String(req.headers["idempotency-key"] || "").trim();
  if (value.length < 8 || value.length > 200) {
    throw Object.assign(new Error("Idempotency-Key must contain 8–200 characters."), { status: 400, code: "idempotency_key_required" });
  }
  return value;
}

function validWebhookUrl(value) {
  let url;
  try { url = new URL(String(value || "")); } catch { return null; }
  const host = url.hostname.toLowerCase();
  const local = host === "localhost" || host.endsWith(".local") || host === "0.0.0.0" || host === "::1" || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  return url.protocol === "https:" && !local ? url.toString() : null;
}

function webhookEvents(input) {
  const values = Array.isArray(input) ? input : [input || "*"];
  const events = [...new Set(values.map(value => String(value).trim().toLowerCase()).filter(value => value === "*" || /^[a-z0-9_.-]{3,120}$/.test(value)))];
  if (!events.length || events.length > 50) {
    throw Object.assign(new Error("events must contain 1–50 valid event names."), { status: 422, code: "invalid_webhook_events" });
  }
  return events;
}

function publicOperation(operation) {
  return {
    id: operation.id,
    status: operation.status,
    type: operation.operation_type,
    chargeCredits: Number(operation.customer_charge_micros || 0) / 1_000_000,
    currency: operation.currency,
    result: operation.response_payload || null,
    createdAt: operation.created_at,
  };
}

async function reserveProviderOperation({ auth, quoteId = null, operationType, idempotencyKey, chargeMicrounits, currency = "USD" }) {
  return transaction(async client => {
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [auth.project_id]);
    const existing = await client.query(
      "select * from developer_provider_operations where project_id = $1 and idempotency_key = $2",
      [auth.project_id, idempotencyKey],
    );
    if (existing.rowCount) return { existing: true, operation: existing.rows[0] };
    const balance = await client.query(
      "select coalesce(balance_microunits, 0)::bigint as balance_microunits from developer_wallet_balances where project_id = $1",
      [auth.project_id],
    );
    if (Number(balance.rows[0]?.balance_microunits || 0) < chargeMicrounits) {
      throw Object.assign(new Error("The project does not have enough Vedøy Credits."), { status: 402, code: "insufficient_credits" });
    }
    const created = await client.query(
      `insert into developer_provider_operations
       (project_id, api_key_id, quote_id, provider, operation_type, idempotency_key, customer_charge_micros, currency)
       values ($1,$2,$3,'telnyx',$4,$5,$6,$7) returning *`,
      [auth.project_id, auth.api_key_id, quoteId, operationType, idempotencyKey, chargeMicrounits, currency],
    );
    if (chargeMicrounits > 0) {
      await client.query(
        `insert into developer_ledger_entries
         (project_id, amount_microunits, entry_type, description, idempotency_key, metadata)
         values ($1,$2,'provider_reservation',$3,$4,$5::jsonb)`,
        [auth.project_id, -chargeMicrounits, `Telnyx ${operationType}`, `provider:${idempotencyKey}`, JSON.stringify({ operationId: created.rows[0].id })],
      );
    }
    return { existing: false, operation: created.rows[0] };
  });
}

async function finishProviderOperation(operation, { status, responsePayload, errorPayload, providerRequestId, providerResourceId, providerCostMicros, refund = false }) {
  return transaction(async client => {
    const updated = await client.query(
      `update developer_provider_operations set status=$2,response_payload=$3::jsonb,error_payload=$4::jsonb,
       provider_request_id=$5,provider_resource_id=$6,provider_cost_micros=$7,updated_at=now()
       where id=$1 returning *`,
      [operation.id, status, responsePayload ? JSON.stringify(responsePayload) : null, errorPayload ? JSON.stringify(errorPayload) : null, providerRequestId || null, providerResourceId || null, providerCostMicros ?? null],
    );
    if (refund && Number(operation.customer_charge_micros) > 0) {
      await client.query(
        `insert into developer_ledger_entries
         (project_id, amount_microunits, entry_type, description, idempotency_key, metadata)
         values ($1,$2,'provider_refund',$3,$4,$5::jsonb) on conflict do nothing`,
        [operation.project_id, operation.customer_charge_micros, `Refund for failed Telnyx ${operation.operation_type}`, `provider-refund:${operation.id}`, JSON.stringify({ operationId: operation.id })],
      );
    }
    return updated.rows[0];
  });
}

export default async function handler(req, res) {
  const path = routePath(req);
  try {
    if (req.method === "OPTIONS") return send(res, 204, {});
    if (req.method === "GET" && (path === "/" || path === "/v1/health")) {
      const database = await query("select current_database() as name");
      return send(res, 200, { ok: true, service: "vedoy-developer-api", version: API_VERSION, database: { provider: process.env.DATABASE_PROVIDER || "postgresql", connected: true, name: database.rows[0].name }, providers: { telnyx: telnyxConfigured() ? "configured" : "not_configured" }, docs: "/openapi.yaml" });
    }
    if (req.method === "GET" && path === "/v1/projects") {
      const user = await requireUser(req);
      const projects = await query("select id,name,slug,status,rate_limit_per_minute,created_at from developer_projects where owner_id = $1 order by created_at desc", [user.id]);
      return send(res, 200, { data: projects.rows });
    }
    if (req.method === "POST" && path === "/v1/projects") {
      const user = await requireUser(req);
      const input = await body(req);
      if (!input.name || String(input.name).trim().length < 2) return send(res, 422, { error: { code: "invalid_name", message: "Project name must contain at least two characters." } });
      const slug = String(input.slug || input.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
      const project = await query(`insert into developer_projects (owner_id, name, slug) values ($1, $2, $3) returning id,name,slug,status,rate_limit_per_minute,created_at`, [user.id, String(input.name).trim(), slug]);
      return send(res, 201, { data: project.rows[0] });
    }
    const apiKeyMatch = path.match(/^\/v1\/projects\/([0-9a-f-]+)\/api-keys$/i);
    if (req.method === "POST" && apiKeyMatch) {
      const user = await requireUser(req);
      const input = await body(req);
      const rawKey = `vdy_live_${randomBytes(24).toString("base64url")}`;
      const keyHash = createHash("sha256").update(rawKey).digest("hex");
      const prefix = rawKey.slice(0, 17);
      const created = await query(
        `insert into developer_api_keys (project_id, name, key_prefix, key_hash)
         select p.id, $3, $4, $5 from developer_projects p where p.id = $1 and p.owner_id = $2
         returning id,project_id,name,key_prefix,last_used_at,expires_at,revoked_at,created_at`,
        [apiKeyMatch[1], user.id, String(input.name || "Default key").trim().slice(0, 80), prefix, keyHash],
      );
      if (!created.rowCount) return send(res, 404, { error: { code: "project_not_found", message: "Project not found." } });
      return send(res, 201, { data: { ...created.rows[0], key: rawKey }, warning: "Copy this key now. It will not be shown again." });
    }
    if (req.method === "GET" && path === "/v1/usage") {
      const user = await requireUser(req);
      const events = await query(`select e.id,e.project_id,e.route,e.method,e.status_code,e.cost_microunits,e.created_at from developer_usage_events e join developer_projects p on p.id = e.project_id where p.owner_id = $1 order by e.created_at desc limit 100`, [user.id]);
      return send(res, 200, { data: events.rows });
    }
    if (req.method === "GET" && path === "/v1/credits/balance") {
      const user = await requireUser(req);
      const wallets = await query(`select b.project_id,b.balance_microunits,b.updated_at from developer_wallet_balances b join developer_projects p on p.id = b.project_id where p.owner_id = $1`, [user.id]);
      return send(res, 200, { data: wallets.rows });
    }
    if (req.method === "GET" && path === "/v1/webhooks/endpoints") {
      const auth = await authorizeApiKey(req, path, 0);
      const endpoints = await query(
        `select id,url,events,enabled,description,created_at,updated_at
           from developer_webhook_endpoints where project_id=$1 order by created_at desc`,
        [auth.project_id],
      );
      return send(res, 200, { data: endpoints.rows }, { "X-RateLimit-Remaining": String(auth.remaining_requests) });
    }
    if (req.method === "POST" && path === "/v1/webhooks/endpoints") {
      const auth = await authorizeApiKey(req, path, 0);
      const input = await body(req);
      const url = validWebhookUrl(input.url);
      if (!url) return send(res, 422, { error: { code: "invalid_webhook_url", message: "Webhook URLs must use public HTTPS and cannot point at a local network." } });
      const events = webhookEvents(input.events);
      webhookEndpointSecret("configuration-check");
      const endpoint = await query(
        `insert into developer_webhook_endpoints (project_id,url,events,description)
         values ($1,$2,$3::text[],$4) returning id,url,events,enabled,description,created_at,updated_at`,
        [auth.project_id, url, events, String(input.description || "").trim().slice(0, 240) || null],
      );
      const created = endpoint.rows[0];
      return send(res, 201, {
        data: { ...created, signingSecret: webhookEndpointSecret(created.id) },
        warning: "Copy signingSecret now. It is derived server-side and will not be returned again.",
      }, { "X-RateLimit-Remaining": String(auth.remaining_requests) });
    }
    if (req.method === "GET" && path === "/v1/webhooks/deliveries") {
      const auth = await authorizeApiKey(req, path, 0);
      const rows = await query(
        `select d.id,d.attempt,d.status,d.response_status,d.response_excerpt,d.delivered_at,d.created_at,
                e.id as event_id,e.event_type,e.payload,e.created_at as event_created_at,
                ep.id as endpoint_id,ep.url
           from developer_webhook_deliveries d
           join developer_webhook_events e on e.id=d.event_id
           join developer_webhook_endpoints ep on ep.id=d.endpoint_id
          where e.project_id=$1 order by d.created_at desc limit 100`,
        [auth.project_id],
      );
      return send(res, 200, { data: rows.rows }, { "X-RateLimit-Remaining": String(auth.remaining_requests) });
    }
    const deliveryRetry = path.match(/^\/v1\/webhooks\/deliveries\/([0-9a-f-]+)\/retry$/i);
    if (req.method === "POST" && deliveryRetry) {
      const auth = await authorizeApiKey(req, path, 0);
      const existing = await query(
        `select d.*,e.id as event_id,e.project_id,e.event_type,e.payload,e.source,e.created_at as event_created_at,
                ep.id as endpoint_id,ep.url,ep.events,ep.enabled
           from developer_webhook_deliveries d
           join developer_webhook_events e on e.id=d.event_id
           join developer_webhook_endpoints ep on ep.id=d.endpoint_id
          where d.id=$1 and e.project_id=$2`,
        [deliveryRetry[1], auth.project_id],
      );
      if (!existing.rowCount) return send(res, 404, { error: { code: "delivery_not_found", message: "Webhook delivery not found." } });
      const item = existing.rows[0];
      if (!item.enabled) return send(res, 409, { error: { code: "endpoint_disabled", message: "Enable this endpoint before retrying a delivery." } });
      const delivery = await deliverWebhook({ id: item.event_id, event_type: item.event_type, payload: item.payload, created_at: item.event_created_at }, { id: item.endpoint_id, url: item.url }, item.attempt + 1);
      return send(res, 202, { data: delivery }, { "X-RateLimit-Remaining": String(auth.remaining_requests) });
    }
    if (req.method === "GET" && path === "/v1/agents") {
      const auth = await authorizeApiKey(req, path, 0);
      const agents = await query(
        `select id,name,instructions,model,monthly_budget_microunits,status,metadata,created_at,updated_at
           from developer_agents where project_id=$1 order by created_at desc`,
        [auth.project_id],
      );
      return send(res, 200, { data: agents.rows }, { "X-RateLimit-Remaining": String(auth.remaining_requests) });
    }
    if (req.method === "POST" && path === "/v1/agents") {
      const auth = await authorizeApiKey(req, path, 0);
      const input = await body(req);
      const name = String(input.name || "").trim();
      if (name.length < 2 || name.length > 120) return send(res, 422, { error: { code: "invalid_agent_name", message: "name must contain 2–120 characters." } });
      const budget = Number(input.monthlyBudgetMicrounits || 0);
      if (!Number.isSafeInteger(budget) || budget < 0) return send(res, 422, { error: { code: "invalid_agent_budget", message: "monthlyBudgetMicrounits must be a non-negative integer." } });
      const agent = await query(
        `insert into developer_agents (project_id,name,instructions,model,monthly_budget_microunits,status,metadata)
         values ($1,$2,$3,$4,$5,$6,$7::jsonb)
         returning id,name,instructions,model,monthly_budget_microunits,status,metadata,created_at,updated_at`,
        [auth.project_id, name, String(input.instructions || "").slice(0, 16_000), String(input.model || "vedoy/router").slice(0, 160), budget, input.status === "active" ? "active" : "draft", JSON.stringify(input.metadata && typeof input.metadata === "object" ? input.metadata : {})],
      );
      return send(res, 201, { data: agent.rows[0] }, { "X-RateLimit-Remaining": String(auth.remaining_requests) });
    }
    const agentRuns = path.match(/^\/v1\/agents\/([0-9a-f-]+)\/runs$/i);
    if (agentRuns && req.method === "GET") {
      const auth = await authorizeApiKey(req, path, 0);
      const runs = await query(
        `select r.id,r.status,r.input,r.output,r.error_code,r.error_message,r.cost_microunits,r.created_at,r.updated_at
           from developer_agent_runs r join developer_agents a on a.id=r.agent_id
          where r.agent_id=$1 and a.project_id=$2 order by r.created_at desc limit 100`,
        [agentRuns[1], auth.project_id],
      );
      return send(res, 200, { data: runs.rows }, { "X-RateLimit-Remaining": String(auth.remaining_requests) });
    }
    if (agentRuns && req.method === "POST") {
      const idempotencyKey = requireIdempotencyKey(req);
      const auth = await authorizeApiKey(req, path, 0);
      const input = await body(req);
      const agent = await query("select * from developer_agents where id=$1 and project_id=$2", [agentRuns[1], auth.project_id]);
      if (!agent.rowCount) return send(res, 404, { error: { code: "agent_not_found", message: "Agent not found." } });
      if (agent.rows[0].status !== "active") return send(res, 409, { error: { code: "agent_not_active", message: "Activate the agent before starting a run." } });
      const created = await query(
        `insert into developer_agent_runs (agent_id,project_id,idempotency_key,status,input,error_code,error_message)
         values ($1,$2,$3,'blocked',$4::jsonb,'agent_runner_not_configured','No agent runner is configured for this deployment.')
         on conflict (project_id,idempotency_key) do update set updated_at=developer_agent_runs.updated_at
         returning *`,
        [agentRuns[1], auth.project_id, idempotencyKey, JSON.stringify(input || {})],
      );
      return send(res, 503, { error: { code: "agent_runner_not_configured", message: "Agent configuration is saved, but no provider runner is configured for this deployment." }, run: created.rows[0] }, { "X-RateLimit-Remaining": String(auth.remaining_requests) });
    }
    if (req.method === "GET" && path === "/v1/models") {
      const auth = await authorizeApiKey(req, path, 0);
      return send(res, 200, { data: [{ id: "vedoy/openai", type: "text", status: "preview" }, { id: "vedoy/router", type: "text", status: "planned" }], projectId: auth.project_id }, { "X-RateLimit-Remaining": String(auth.remaining_requests) });
    }
    if (req.method === "GET" && path === "/v1/numbers/available") {
      const auth = await authorizeApiKey(req, path, 0);
      const url = requestUrl(req);
      const country = String(url.searchParams.get("country") || "NO").toUpperCase();
      const numberType = String(url.searchParams.get("type") || "local").toLowerCase();
      const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") || 10)));
      if (!/^[A-Z]{2}$/.test(country)) return send(res, 422, { error: { code: "invalid_country", message: "country must be an ISO 3166-1 alpha-2 code." } });
      if (!new Set(["local", "toll_free", "mobile", "national", "shared_cost"]).has(numberType)) return send(res, 422, { error: { code: "invalid_number_type", message: "Unsupported phone number type." } });
      const params = new URLSearchParams({
        "filter[country_code]": country,
        "filter[phone_number_type]": numberType,
        "filter[limit]": String(limit),
        "filter[best_effort]": "false",
      });
      params.append("filter[features]", "sms");
      params.append("filter[features]", "voice");
      const { payload } = await telnyxRequest(`/available_phone_numbers?${params}`);
      const pricing = pricingConfiguration();
      const numbers = [];
      for (const raw of payload.data || []) {
        const item = normalizeAvailableNumber(raw, pricing);
        if (!item.phoneNumber || item.currency !== "USD") continue;
        const quote = await query(
          `insert into developer_provider_quotes
           (project_id,provider,product_type,provider_reference,currency,provider_upfront_micros,provider_recurring_micros,
            customer_upfront_micros,customer_recurring_micros,gross_margin_bps,metadata,expires_at)
           values ($1,'telnyx','phone_number',$2,$3,$4,$5,$6,$7,$8,$9::jsonb,now()+interval '10 minutes') returning id,expires_at`,
          [auth.project_id, item.phoneNumber, item.currency, item.providerUpfrontMicros, item.providerMonthlyMicros, item.customerUpfrontMicros, item.customerMonthlyMicros, pricing.grossMarginBps, JSON.stringify({ countryCode: country, numberType, features: item.features })],
        );
        numbers.push({
          quoteId: quote.rows[0].id,
          expiresAt: quote.rows[0].expires_at,
          phoneNumber: item.phoneNumber,
          countryCode: country,
          numberType,
          capabilities: { sms: item.features.includes("sms"), voice: item.features.includes("voice") },
          price: {
            currency: item.currency,
            upfrontCredits: item.customerUpfrontCredits,
            monthlyCredits: item.customerMonthlyCredits,
            grossMarginTarget: pricing.grossMarginBps / 10_000,
          },
        });
      }
      return send(res, 200, { data: numbers }, { "X-RateLimit-Remaining": String(auth.remaining_requests) });
    }
    if (req.method === "GET" && path === "/v1/numbers") {
      const auth = await authorizeApiKey(req, path, 0);
      const numbers = await query(
        `select id,phone_number,status,country_code,number_type,currency,
         customer_monthly_micros,capabilities,created_at,updated_at
         from developer_phone_numbers where project_id=$1 order by created_at desc`,
        [auth.project_id],
      );
      return send(res, 200, { data: numbers.rows.map(item => ({ ...item, monthlyCredits: Number(item.customer_monthly_micros) / 1_000_000 })) });
    }
    if (req.method === "POST" && path === "/v1/numbers/purchase") {
      const idempotencyKey = requireIdempotencyKey(req);
      const auth = await authorizeApiKey(req, path, 0);
      const input = await body(req);
      const quote = await query(
        `select * from developer_provider_quotes where id=$1 and project_id=$2 and provider='telnyx'
         and product_type='phone_number' and expires_at>now()`,
        [input.quoteId, auth.project_id],
      );
      if (!quote.rowCount) return send(res, 410, { error: { code: "quote_expired", message: "Search again to obtain a current number quote." } });
      const pricing = pricingConfiguration();
      const priced = quote.rows[0];
      const customerUsdMicros = Number(priced.customer_upfront_micros) + Number(priced.customer_recurring_micros);
      const chargeMicrounits = usdToCreditsMicrounits(customerUsdMicros, pricing.creditUsdMicros);
      const reserved = await reserveProviderOperation({ auth, quoteId: priced.id, operationType: "number_purchase", idempotencyKey, chargeMicrounits, currency: priced.currency });
      if (reserved.existing) {
        if (reserved.operation.status === "succeeded") return send(res, 200, { data: publicOperation(reserved.operation), idempotentReplay: true });
        return send(res, reserved.operation.status === "failed" ? 422 : 409, { error: { code: `provider_operation_${reserved.operation.status}`, message: "This operation already exists. Use its operation ID for support or reconciliation." }, operation: publicOperation(reserved.operation) });
      }
      try {
        const { payload, requestId } = await telnyxRequest("/number_orders", {
          method: "POST",
          idempotencyKey,
          body: { phone_numbers: [{ phone_number: priced.provider_reference }], customer_reference: reserved.operation.id },
        });
        const order = payload.data || {};
        const result = { operationId: reserved.operation.id, orderId: order.id || null, phoneNumber: priced.provider_reference, status: order.status || "pending", chargedCredits: chargeMicrounits / 1_000_000, monthlyCredits: usdToCreditsMicrounits(Number(priced.customer_recurring_micros), pricing.creditUsdMicros) / 1_000_000, currency: priced.currency };
        await query(
          `insert into developer_phone_numbers
           (project_id,provider,provider_order_id,phone_number,status,country_code,number_type,currency,customer_monthly_micros,provider_monthly_micros,capabilities)
           values ($1,'telnyx',$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) on conflict (provider,phone_number) do update set status=excluded.status,updated_at=now()`,
          [auth.project_id, order.id || null, priced.provider_reference, order.status || "pending", priced.metadata?.countryCode || null, priced.metadata?.numberType || null, priced.currency, usdToCreditsMicrounits(Number(priced.customer_recurring_micros), pricing.creditUsdMicros), priced.provider_recurring_micros, JSON.stringify(priced.metadata?.features || [])],
        );
        await finishProviderOperation(reserved.operation, { status: "succeeded", responsePayload: result, providerRequestId: requestId, providerResourceId: order.id, providerCostMicros: Number(priced.provider_upfront_micros) + Number(priced.provider_recurring_micros) });
        await emitWebhookEvent({ projectId: auth.project_id, eventType: "number_order.created", payload: result, source: "telnyx" }).catch(() => {});
        return send(res, 201, { data: result });
      } catch (error) {
        const status = error.outcomeUnknown ? "unknown" : "failed";
        const operation = await finishProviderOperation(reserved.operation, { status, errorPayload: { code: error.code, message: error.message, providerStatus: error.providerStatus }, refund: !error.outcomeUnknown });
        throw Object.assign(error, { operation: publicOperation(operation) });
      }
    }
    if (req.method === "POST" && path === "/v1/messages") {
      const idempotencyKey = requireIdempotencyKey(req);
      const auth = await authorizeApiKey(req, path, 0);
      const input = await body(req);
      const from = String(input.from || "").trim();
      const to = String(input.to || "").trim();
      const text = String(input.text || input.body || "").trim();
      if (!/^\+[1-9]\d{6,14}$/.test(from) || !/^\+[1-9]\d{6,14}$/.test(to)) return send(res, 422, { error: { code: "invalid_phone_number", message: "from and to must use E.164 format." } });
      if (!text || text.length > 1600) return send(res, 422, { error: { code: "invalid_message", message: "text must contain 1–1600 characters." } });
      const owned = await query("select id from developer_phone_numbers where project_id=$1 and phone_number=$2 and status in ('success','active')", [auth.project_id, from]);
      if (!owned.rowCount) return send(res, 403, { error: { code: "from_number_not_owned", message: "The from number is not owned by this project." } });
      const pricing = pricingConfiguration();
      if (!pricing.smsProviderUsdMicros) return send(res, 503, { error: { code: "sms_pricing_not_configured", message: "SMS pricing is not enabled for this deployment." } });
      const retailUsdMicros = retailMicros(pricing.smsProviderUsdMicros, pricing.grossMarginBps);
      const chargeMicrounits = usdToCreditsMicrounits(retailUsdMicros, pricing.creditUsdMicros);
      const reserved = await reserveProviderOperation({ auth, operationType: "message_send", idempotencyKey, chargeMicrounits, currency: "USD" });
      if (reserved.existing) {
        if (reserved.operation.status === "succeeded") return send(res, 200, { data: publicOperation(reserved.operation), idempotentReplay: true });
        return send(res, reserved.operation.status === "failed" ? 422 : 409, { error: { code: `provider_operation_${reserved.operation.status}`, message: "This operation already exists." }, operation: publicOperation(reserved.operation) });
      }
      try {
        const requestBody = { from, to, text };
        if (process.env.TELNYX_MESSAGING_PROFILE_ID) requestBody.messaging_profile_id = process.env.TELNYX_MESSAGING_PROFILE_ID;
        const { payload, requestId } = await telnyxRequest("/messages", { method: "POST", body: requestBody, idempotencyKey });
        const message = payload.data || {};
        const result = { operationId: reserved.operation.id, messageId: message.id || null, from, to, status: message.to?.[0]?.status || "queued", chargedCredits: chargeMicrounits / 1_000_000 };
        await query(
          `insert into developer_messages
           (project_id,provider,provider_message_id,from_number,to_number,status,customer_charge_micros,provider_cost_micros,currency,parts)
           values ($1,'telnyx',$2,$3,$4,$5,$6,$7,'USD',$8)`,
          [auth.project_id, message.id || null, from, to, result.status, chargeMicrounits, pricing.smsProviderUsdMicros, message.parts || null],
        );
        await finishProviderOperation(reserved.operation, { status: "succeeded", responsePayload: result, providerRequestId: requestId, providerResourceId: message.id, providerCostMicros: pricing.smsProviderUsdMicros });
        await emitWebhookEvent({ projectId: auth.project_id, eventType: "message.sent", payload: result, source: "telnyx" }).catch(() => {});
        return send(res, 202, { data: result });
      } catch (error) {
        const status = error.outcomeUnknown ? "unknown" : "failed";
        const operation = await finishProviderOperation(reserved.operation, { status, errorPayload: { code: error.code, message: error.message, providerStatus: error.providerStatus }, refund: !error.outcomeUnknown });
        throw Object.assign(error, { operation: publicOperation(operation) });
      }
    }
    if (path.startsWith("/v1/")) return send(res, 501, { error: { code: "capability_not_configured", message: "This API contract is documented, but its provider-backed implementation is not enabled yet." } });
    return send(res, 404, { error: { code: "not_found", message: "Route not found." } });
  } catch (error) {
    const headers = error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {};
    const conflict = error.code === "23505";
    return send(res, conflict ? 409 : error.status || 500, { error: { code: conflict ? "conflict" : error.code || "internal_error", message: conflict ? "A resource with the same unique value already exists." : error.status && error.status < 500 ? error.message : "The API could not complete the request." }, ...(error.operation ? { operation: error.operation } : {}) }, headers);
  }
}
