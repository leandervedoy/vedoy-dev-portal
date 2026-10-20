import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAvailableNumber, retailMicros, usdToCreditsMicrounits } from "../lib/telnyx.js";

test("20 percent gross margin divides provider cost by 0.8", () => {
  assert.equal(retailMicros(1_000_000, 2000), 1_250_000);
});

test("credit conversion rounds up to whole credits", () => {
  assert.equal(usdToCreditsMicrounits(1_250_000, 10_000), 125_000_000);
});

test("available number prices hide provider math from the public shape", () => {
  const result = normalizeAvailableNumber({
    phone_number: "+4721000000",
    phone_number_type: "local",
    features: ["sms", "voice"],
    cost_information: { currency: "USD", monthly_cost: "1.00", upfront_cost: "0.40" },
  }, { grossMarginBps: 2000, creditUsdMicros: 10_000 });
  assert.equal(result.customerMonthlyMicros, 1_250_000);
  assert.equal(result.customerUpfrontCredits, 50);
});
