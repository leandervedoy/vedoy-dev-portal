import Stripe from "stripe";

const PRODUCT_DEFINITIONS = [
  { slug: "starter", name: "Starter credits", credits: 2_500, env: "STRIPE_PRICE_CREDITS_STARTER" },
  { slug: "scale", name: "Scale credits", credits: 15_000, env: "STRIPE_PRICE_CREDITS_SCALE" },
];

export function billingProducts(env = process.env) {
  return PRODUCT_DEFINITIONS.map((product) => ({ ...product, priceId: env[product.env] || null }));
}

export function purchasableProduct(slug, env = process.env) {
  return billingProducts(env).find((product) => product.slug === slug && product.priceId) || null;
}

export function stripeClient(env = process.env) {
  if (!env.STRIPE_SECRET_KEY) return null;
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-08-26.dahlia" });
}

export function checkoutFulfillmentData(session) {
  const projectId = session?.metadata?.project_id;
  const credits = Number(session?.metadata?.credits);
  if (session?.payment_status !== "paid" || !session?.id || !projectId || !Number.isSafeInteger(credits) || credits <= 0) return null;
  return { projectId, creditsMicrounits: credits * 1_000_000, idempotencyKey: `stripe:${session.id}`,
    stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id || null,
    amountMinor: Number(session.amount_total || 0), currency: String(session.currency || "nok").toUpperCase(),
    productSlug: session.metadata.product_slug || "credits" };
}
