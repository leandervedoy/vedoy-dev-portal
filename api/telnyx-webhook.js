import { query } from "../lib/database.js";
import { verifyTelnyxWebhook } from "../lib/telnyx.js";
import { emitWebhookEvent } from "../lib/webhooks.js";

export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function headers(req) {
  return Object.fromEntries(Object.entries(req.headers || {}).map(([key, value]) => [key.toLowerCase(), value]));
}

async function updateMessage(eventType, payload) {
  const messageId = payload.id || payload.record_type === "message" && payload.id;
  if (!messageId) return;
  const status = payload.to?.[0]?.status || payload.status || eventType.replace("message.", "");
  const result = await query(
    `update developer_messages
        set status = $2,
            provider_payload = coalesce(provider_payload, '{}'::jsonb) || $3::jsonb,
            updated_at = now()
      where provider = 'telnyx' and provider_message_id = $1
      returning project_id,provider_message_id,status`,
    [messageId, status, JSON.stringify({ last_event: eventType, payload })],
  );
  return result.rows[0] || null;
}

async function updateNumberOrder(eventType, payload) {
  const orderId = payload.id || payload.number_order_id;
  if (!orderId) return;
  const status = payload.status || (eventType.includes("failed") ? "failed" : "active");
  const result = await query(
    `update developer_phone_numbers
        set status = $2, updated_at = now()
      where provider = 'telnyx' and provider_order_id = $1
      returning project_id,phone_number,status`,
    [orderId, status],
  );
  return result.rows[0] || null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  const rawBody = await readRawBody(req);
  if (!verifyTelnyxWebhook(rawBody, headers(req))) {
    return res.status(401).json({ error: "invalid_signature" });
  }
  let envelope;
  try {
    envelope = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: "invalid_json" });
  }
  const event = envelope.data || {};
  const eventId = event.id;
  const eventType = event.event_type;
  const payload = event.payload || {};
  if (!eventId || !eventType) return res.status(400).json({ error: "invalid_event" });

  const inserted = await query(
    `insert into developer_provider_webhooks
      (provider, provider_event_id, event_type, payload)
     values ('telnyx', $1, $2, $3::jsonb)
     on conflict (provider, provider_event_id) do nothing
     returning id`,
    [eventId, eventType, JSON.stringify(envelope)],
  );
  if (!inserted.rowCount) return res.status(204).end();

  try {
    let resource = null;
    if (eventType.startsWith("message.")) resource = await updateMessage(eventType, payload);
    if (eventType.startsWith("number_order.")) resource = await updateNumberOrder(eventType, payload);
    if (resource?.project_id) {
      await emitWebhookEvent({
        projectId: resource.project_id,
        eventType: eventType.replace(/:/g, ".").toLowerCase(),
        payload: { provider: "telnyx", resource, event: payload },
        source: "telnyx",
      }).catch(() => {});
    }
    await query(
      `update developer_provider_webhooks
          set processed_at = now()
        where provider = 'telnyx' and provider_event_id = $1`,
      [eventId],
    );
    return res.status(204).end();
  } catch (error) {
    await query(
      `update developer_provider_webhooks
          set processing_error = $2
        where provider = 'telnyx' and provider_event_id = $1`,
      [eventId, String(error?.message || error).slice(0, 1000)],
    ).catch(() => {});
    throw error;
  }
}
