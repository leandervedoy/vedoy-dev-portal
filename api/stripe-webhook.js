import { transaction } from "../lib/database.js";
import { checkoutFulfillmentData, stripeClient } from "../lib/billing.js";

async function rawBody(req) { const chunks=[]; for await (const chunk of req) chunks.push(Buffer.from(chunk)); return Buffer.concat(chunks); }

export default async function handler(req,res) {
  if(req.method!=="POST") return res.status(405).json({error:"method_not_allowed"});
  const stripe=stripeClient();
  if(!stripe||!process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({error:"stripe_not_configured"});
  try {
    const event=stripe.webhooks.constructEvent(await rawBody(req),req.headers["stripe-signature"],process.env.STRIPE_WEBHOOK_SECRET);
    if(["checkout.session.completed","checkout.session.async_payment_succeeded"].includes(event.type)) {
      const f=checkoutFulfillmentData(event.data.object);
      if(f) await transaction(async client=>{
        const seen=await client.query("insert into developer_stripe_events (stripe_event_id,event_type) values ($1,$2) on conflict do nothing returning stripe_event_id",[event.id,event.type]);
        if(!seen.rowCount)return;
        await client.query(`insert into developer_checkout_sessions (stripe_session_id,project_id,product_slug,credits_microunits,amount_minor,currency,payment_status,completed_at) values ($1,$2,$3,$4,$5,$6,'paid',now()) on conflict (stripe_session_id) do update set payment_status='paid',amount_minor=excluded.amount_minor,currency=excluded.currency,completed_at=now()`,[event.data.object.id,f.projectId,f.productSlug,f.creditsMicrounits,f.amountMinor,f.currency]);
        await client.query(`insert into developer_ledger_entries (project_id,amount_microunits,entry_type,description,idempotency_key,metadata) values ($1,$2,'stripe_purchase',$3,$4,$5::jsonb) on conflict (project_id,idempotency_key) do nothing`,[f.projectId,f.creditsMicrounits,`Stripe credit purchase: ${f.productSlug}`,f.idempotencyKey,JSON.stringify({stripeCustomerId:f.stripeCustomerId,amountMinor:f.amountMinor,currency:f.currency})]);
        if(f.stripeCustomerId) await client.query(`insert into developer_billing_customers (project_id,stripe_customer_id) values ($1,$2) on conflict (project_id) do update set stripe_customer_id=excluded.stripe_customer_id,updated_at=now()`,[f.projectId,f.stripeCustomerId]);
      });
    }
    return res.status(200).json({received:true});
  } catch(error) { return res.status(400).json({error:"invalid_webhook",message:error.message}); }
}
