import { createPublicKey, verify } from "node:crypto";

const baseUrl = "https://api.telnyx.com/v2";

export function telnyxConfigured() {
  return Boolean(process.env.TELNYX_API_KEY);
}

export function pricingConfiguration() {
  const grossMarginBps = Number(process.env.VEDOY_GROSS_MARGIN_BPS || 2000);
  const creditUsdMicros = Number(process.env.VEDOY_CREDIT_USD_MICROS || 10_000);
  const smsProviderUsdMicros = Number(process.env.TELNYX_SMS_PROVIDER_USD_MICROS || 0);
  if (!Number.isInteger(grossMarginBps) || grossMarginBps < 0 || grossMarginBps >= 9000) {
    throw new Error("VEDOY_GROSS_MARGIN_BPS must be an integer between 0 and 8999.");
  }
  if (!Number.isInteger(creditUsdMicros) || creditUsdMicros <= 0) {
    throw new Error("VEDOY_CREDIT_USD_MICROS must be a positive integer.");
  }
  if (!Number.isInteger(smsProviderUsdMicros) || smsProviderUsdMicros < 0) {
    throw new Error("TELNYX_SMS_PROVIDER_USD_MICROS must be a non-negative integer.");
  }
  return { grossMarginBps, creditUsdMicros, smsProviderUsdMicros };
}

export function retailMicros(providerMicros, grossMarginBps) {
  if (!Number.isSafeInteger(providerMicros) || providerMicros < 0) throw new Error("Invalid provider cost.");
  if (!Number.isInteger(grossMarginBps) || grossMarginBps < 0 || grossMarginBps >= 10_000) throw new Error("Invalid gross margin.");
  const numerator = BigInt(providerMicros) * 10_000n;
  const denominator = BigInt(10_000 - grossMarginBps);
  const retailMicros = (numerator + denominator - 1n) / denominator;
  if (retailMicros > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Retail price is out of range.");
  return Number(retailMicros);
}

export function usdToCreditsMicrounits(usdMicros, creditUsdMicros) {
  if (!Number.isSafeInteger(usdMicros) || usdMicros < 0 || !Number.isSafeInteger(creditUsdMicros) || creditUsdMicros <= 0) {
    throw new Error("Invalid credit conversion amount.");
  }
  const price = BigInt(usdMicros);
  const creditValue = BigInt(creditUsdMicros);
  const credits = (price + creditValue - 1n) / creditValue;
  const microunits = credits * 1_000_000n;
  if (microunits > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Credit amount is out of range.");
  return Number(microunits);
}

function parseMoneyMicros(value) {
  const normalized = String(value ?? "0").trim();
  const match = normalized.match(/^(\d+)(?:\.(\d{1,6}))?$/);
  if (!match) throw Object.assign(new Error("Telnyx returned an invalid price."), { status: 502, code: "invalid_provider_pricing" });
  const micros = BigInt(match[1]) * 1_000_000n + BigInt((match[2] || "").padEnd(6, "0") || "0");
  if (micros > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw Object.assign(new Error("Telnyx returned a price outside the supported range."), { status: 502, code: "invalid_provider_pricing" });
  }
  return Number(micros);
}

export function normalizeAvailableNumber(item, pricing) {
  const cost = item.cost_information || item.cost;
  if (!cost || (cost.monthly_cost == null && cost.amount == null)) {
    throw Object.assign(new Error("Telnyx did not return monthly number pricing."), { status: 502, code: "provider_pricing_unavailable" });
  }
  const currency = String(cost.currency || "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw Object.assign(new Error("Telnyx returned an invalid number price currency."), { status: 502, code: "invalid_provider_pricing" });
  }
  const providerMonthlyMicros = parseMoneyMicros(cost.monthly_cost ?? cost.amount ?? 0);
  const providerUpfrontMicros = parseMoneyMicros(cost.upfront_cost ?? 0);
  const customerMonthlyMicros = retailMicros(providerMonthlyMicros, pricing.grossMarginBps);
  const customerUpfrontMicros = retailMicros(providerUpfrontMicros, pricing.grossMarginBps);
  return {
    phoneNumber: item.phone_number,
    countryCode: item.region_information?.find(region => region.region_type === "country_code")?.region_name || null,
    numberType: item.phone_number_type || null,
    features: Array.isArray(item.features) ? item.features : [],
    currency,
    providerMonthlyMicros,
    providerUpfrontMicros,
    customerMonthlyMicros,
    customerUpfrontMicros,
    customerMonthlyCredits: usdToCreditsMicrounits(customerMonthlyMicros, pricing.creditUsdMicros) / 1_000_000,
    customerUpfrontCredits: usdToCreditsMicrounits(customerUpfrontMicros, pricing.creditUsdMicros) / 1_000_000,
  };
}

export async function telnyxRequest(path, { method = "GET", body, idempotencyKey } = {}) {
  if (!process.env.TELNYX_API_KEY) {
    throw Object.assign(new Error("Telnyx is not configured."), { status: 503, code: "provider_not_configured" });
  }
  const headers = {
    Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });
  } catch (cause) {
    throw Object.assign(new Error("The Telnyx outcome is unknown. Retry with the same Idempotency-Key."), {
      status: 503,
      code: "provider_outcome_unknown",
      outcomeUnknown: true,
      cause,
    });
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.errors?.[0]?.detail || payload?.errors?.[0]?.title || "Telnyx rejected the request.";
    throw Object.assign(new Error(detail), {
      status: response.status >= 500 ? 503 : 422,
      code: response.status >= 500 ? "provider_outcome_unknown" : "provider_rejected",
      outcomeUnknown: response.status >= 500,
      providerStatus: response.status,
      providerPayload: payload,
    });
  }
  return { payload, requestId: response.headers.get("x-request-id") };
}

export function verifyTelnyxWebhook(rawBody, headers) {
  const publicKey = process.env.TELNYX_PUBLIC_KEY;
  const signature = headers["telnyx-signature-ed25519"];
  const timestamp = headers["telnyx-timestamp"];
  if (!publicKey || !signature || !timestamp) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const key = publicKey.includes("BEGIN PUBLIC KEY")
    ? createPublicKey(publicKey.replace(/\\n/g, "\n"))
    : createPublicKey({ key: Buffer.from(publicKey, "base64"), format: "der", type: "spki" });
  return verify(null, Buffer.from(`${timestamp}|${rawBody}`), key, Buffer.from(signature, "base64"));
}
