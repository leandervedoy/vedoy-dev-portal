import { createHmac } from "node:crypto";
import { query } from "./database.js";

function signingKey() {
  const value = String(process.env.VEDOY_WEBHOOK_SIGNING_SECRET || "").trim();
  if (value.length < 32) {
    throw Object.assign(new Error("Webhook signing is not configured."), { status: 503, code: "webhooks_not_configured" });
  }
  return value;
}

function signature(secret, timestamp, body) {
  return `v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

export function webhookEndpointSecret(endpointId) {
  return createHmac("sha256", signingKey()).update(`endpoint:${endpointId}`).digest("hex");
}

export async function emitWebhookEvent({ projectId, eventType, payload, source = "vedoy" }) {
  const event = await query(
    `insert into developer_webhook_events (project_id,event_type,payload,source)
     values ($1,$2,$3::jsonb,$4) returning *`,
    [projectId, eventType, JSON.stringify(payload || {}), source],
  );
  const endpoints = await query(
    `select * from developer_webhook_endpoints
      where project_id=$1 and enabled=true and ($2 = any(events) or '*' = any(events))`,
    [projectId, eventType],
  );
  const deliveries = await Promise.all(endpoints.rows.map(endpoint => deliverWebhook(event.rows[0], endpoint)));
  return { event: event.rows[0], deliveries };
}

export async function deliverWebhook(event, endpoint, attempt = 1) {
  const delivery = await query(
    `insert into developer_webhook_deliveries (event_id,endpoint_id,attempt)
     values ($1,$2,$3) returning *`,
    [event.id, endpoint.id, attempt],
  );
  const envelope = {
    id: event.id,
    type: event.event_type,
    created_at: event.created_at,
    data: event.payload,
  };
  const body = JSON.stringify(envelope);
  const timestamp = String(Math.floor(Date.now() / 1000));
  let status = 0;
  let excerpt = "";
  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Vedoy-Webhooks/1.0",
        "X-Vedoy-Event": event.event_type,
        "X-Vedoy-Timestamp": timestamp,
        "X-Vedoy-Signature": signature(webhookEndpointSecret(endpoint.id), timestamp, body),
      },
      body,
      signal: AbortSignal.timeout(8_000),
    });
    status = response.status;
    excerpt = (await response.text().catch(() => "")).slice(0, 1000);
  } catch (error) {
    excerpt = String(error?.message || "Network error").slice(0, 1000);
  }
  const outcome = status >= 200 && status < 300 ? "delivered" : "failed";
  const updated = await query(
    `update developer_webhook_deliveries
        set status=$2,response_status=$3,response_excerpt=$4,
            delivered_at=case when $2='delivered' then now() else null end,updated_at=now()
      where id=$1 returning *`,
    [delivery.rows[0].id, outcome, status || null, excerpt || null],
  );
  return updated.rows[0];
}
