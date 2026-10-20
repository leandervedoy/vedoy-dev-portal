import test from "node:test";
import assert from "node:assert/strict";
import { billingProducts, checkoutFulfillmentData } from "../lib/billing.js";

test("billing catalog exposes fixed server-priced credit packs", () => {
  const products = billingProducts({
    STRIPE_PRICE_CREDITS_STARTER: "price_starter",
    STRIPE_PRICE_CREDITS_SCALE: "price_scale",
  });
  assert.deepEqual(products.map(({ slug, credits, priceId }) => ({ slug, credits, priceId })), [
    { slug: "starter", credits: 2_500, priceId: "price_starter" },
    { slug: "scale", credits: 15_000, priceId: "price_scale" },
  ]);
});

test("checkout fulfillment rejects unpaid or malformed sessions", () => {
  assert.equal(checkoutFulfillmentData({ payment_status: "unpaid", metadata: {} }), null);
  assert.equal(checkoutFulfillmentData({ payment_status: "paid", metadata: { project_id: "p" } }), null);
});

test("checkout fulfillment returns an idempotent ledger instruction", () => {
  assert.deepEqual(checkoutFulfillmentData({
    id: "cs_test_123",
    payment_status: "paid",
    customer: "cus_123",
    amount_total: 2500,
    currency: "nok",
    metadata: { project_id: "project-1", credits: "2500", product_slug: "starter" },
  }), {
    projectId: "project-1",
    creditsMicrounits: 2_500_000_000,
    idempotencyKey: "stripe:cs_test_123",
    stripeCustomerId: "cus_123",
    amountMinor: 2500,
    currency: "NOK",
    productSlug: "starter",
  });
});
