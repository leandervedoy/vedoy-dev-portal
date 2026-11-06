import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAvailableNumber, retailMicros, usdToCreditsMicrounits } from "../lib/twilio.js";

test("20 percent gross margin divides provider cost by 0.8", () => {
  assert.equal(retailMicros(1_000_000, 2000), 1_250_000);
  assert.equal(retailMicros(99, 2000), 124);
});

test("credit conversion rounds up to whole credits", () => {
  assert.equal(usdToCreditsMicrounits(1_250_000, 10_000), 125_000_000);
});

test("available number prices hide provider math from the public shape", () => {
  const result = normalizeAvailableNumber({
    phone_number: "+4721000000",
    capabilities: { SMS: true, voice: true },
  }, {
    grossMarginBps: 2000,
    creditUsdMicros: 10_000,
    numberMonthlyUsdMicros: 1_000_000,
    numberUpfrontUsdMicros: 400_000,
  });
  assert.equal(result.customerMonthlyMicros, 1_250_000);
  assert.equal(result.customerUpfrontCredits, 50);
  assert.deepEqual(result.features, ["sms", "voice"]);
});

