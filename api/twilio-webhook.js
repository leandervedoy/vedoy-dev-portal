import { query } from "../lib/database.js";
import { emitWebhookEvent } from "../lib/webhooks.js";
import { verifyTwilioWebhook } from "../lib/twilio.js";

async function formBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString("utf8")));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const params = await formBody(req);
  const url = `${process.env.VEDOY_PUBLIC_URL || "https://vedoy-dev-portal.vercel.app"}/api/twilio-webhook`;
  if (!verifyTwilioWebhook({ signature: req.headers["x-twilio-signature"], url, params })) {
    return res.status(403).json({ error: "invalid_signature" });
  }

  const messageSid = params.MessageSid || params.SmsSid;
  const status = params.MessageStatus || params.SmsStatus || "received";
  if (messageSid) {
    await query(
      `update developer_messages set status=$2,provider_payload=$3::jsonb,updated_at=now()
        where provider='twilio' and provider_message_id=$1`,
      [messageSid, status, JSON.stringify(params)],
    );
  }

  if (params.To && params.From && params.Body) {
    const owned = await query("select project_id from developer_phone_numbers where provider='twilio' and phone_number=$1 and status='active' limit 1", [params.To]);
    if (owned.rowCount) {
      await query(
        `insert into developer_messages (project_id,provider,provider_message_id,from_number,to_number,direction,status,provider_payload)
         values ($1,'twilio',$2,$3,$4,'inbound','received',$5::jsonb)
         on conflict (provider,provider_message_id) do update set status='received',provider_payload=excluded.provider_payload,updated_at=now()`,
        [owned.rows[0].project_id, messageSid, params.From, params.To, JSON.stringify(params)],
      );
      await emitWebhookEvent({ projectId: owned.rows[0].project_id, eventType: "message.received", payload: { messageId: messageSid, from: params.From, to: params.To, text: params.Body }, source: "twilio" }).catch(() => {});
    }
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/xml; charset=utf-8");
  return res.end("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>");
}
