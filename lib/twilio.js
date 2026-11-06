import { createHmac, timingSafeEqual } from "node:crypto";

const API_BASE = "https://api.twilio.com/2010-04-01";

export function twilioConfigured(env = process.env) {
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_API_KEY && env.TWILIO_API_SECRET);
}

function positiveInteger(value, fallback = 0) {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("Twilio pricing values must be non-negative integers.");
  return parsed;
}

export function pricingConfiguration(env = process.env) {
  const grossMarginBps = positiveInteger(env.VEDOY_GROSS_MARGIN_BPS, 2000);
  if (grossMarginBps >= 10_000) throw new Error("VEDOY_GROSS_MARGIN_BPS must be below 10000.");
  return {
    grossMarginBps,
    creditUsdMicros: positiveInteger(env.VEDOY_CREDIT_USD_MICROS, 10_000),
    smsProviderUsdMicros: positiveInteger(env.TWILIO_SMS_PROVIDER_USD_MICROS, 0),
    numberUpfrontUsdMicros: positiveInteger(env.TWILIO_NUMBER_UPFRONT_USD_MICROS, 0),
    numberMonthlyUsdMicros: positiveInteger(env.TWILIO_NUMBER_MONTHLY_USD_MICROS, 0),
  };
}

export function retailMicros(providerMicros, grossMarginBps) {
  return Math.ceil((Number(providerMicros) * 10_000) / (10_000 - Number(grossMarginBps)));
}

export function usdToCreditsMicrounits(usdMicros, creditUsdMicros) {
  if (!creditUsdMicros) throw new Error("VEDOY_CREDIT_USD_MICROS must be greater than zero.");
  return Math.ceil(Number(usdMicros) / Number(creditUsdMicros)) * 1_000_000;
}

function credentials(env = process.env) {
  if (!twilioConfigured(env)) throw Object.assign(new Error("Twilio is not configured."), { status: 503, code: "provider_not_configured" });
  return { accountSid: env.TWILIO_ACCOUNT_SID, username: env.TWILIO_API_KEY, password: env.TWILIO_API_SECRET };
}

export async function twilioRequest(path, { method = "GET", form, query, body, timeoutMs = 8_000 } = {}) {
  const { accountSid, username, password } = credentials();
  let responseMode = "native";
  if (path.startsWith("/available_phone_numbers")) {
    const legacy = new URL(path, "https://twilio.local");
    const country = legacy.searchParams.get("filter[country_code]") || "NO";
    const numberType = legacy.searchParams.get("filter[phone_number_type]") || "local";
    const resource = twilioNumberResource(numberType);
    if (!resource) throw Object.assign(new Error("Twilio does not support this number type through the API."), { status: 422, code: "invalid_number_type" });
    path = `/AvailablePhoneNumbers/${country}/${resource}.json`;
    query = { SmsEnabled: true, VoiceEnabled: true, PageSize: legacy.searchParams.get("filter[limit]") || 10 };
    responseMode = "inventory";
  } else if (path === "/number_orders") {
    path = "/IncomingPhoneNumbers.json";
    form = {
      PhoneNumber: body?.phone_numbers?.[0]?.phone_number,
      SmsUrl: `${process.env.VEDOY_PUBLIC_URL || "https://vedoy-dev-portal.vercel.app"}/api/twilio-webhook`,
    };
    responseMode = "number";
  } else if (path === "/messages") {
    path = "/Messages.json";
    form = { To: body?.to, Body: body?.text };
    if (body?.messaging_service_sid) form.MessagingServiceSid = body.messaging_service_sid;
    else form.From = body?.from;
    form.StatusCallback = `${process.env.VEDOY_PUBLIC_URL || "https://vedoy-dev-portal.vercel.app"}/api/twilio-webhook`;
    responseMode = "message";
  }
  const url = new URL(`${API_BASE}/Accounts/${accountSid}${path}`);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
        Accept: "application/json",
        ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body: form ? new URLSearchParams(form).toString() : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    throw Object.assign(new Error("The Twilio outcome is unknown. Retry with the same Idempotency-Key."), {
      status: 503, code: "provider_outcome_unknown", outcomeUnknown: method !== "GET", cause: error,
    });
  } finally {
    clearTimeout(timer);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.message || "Twilio rejected the request.";
    throw Object.assign(new Error(message), {
      status: response.status >= 500 ? 503 : 422,
      code: "provider_request_failed",
      providerStatus: response.status,
      providerCode: payload.code || null,
    });
  }
  const requestId = response.headers.get("twilio-request-id") || response.headers.get("x-home-region");
  if (responseMode === "inventory") {
    return { payload: { data: (payload.available_phone_numbers || []).map(item => ({ ...item, features: Object.entries(item.capabilities || {}).filter(([,enabled]) => enabled).map(([name]) => name.toLowerCase()) })) }, requestId };
  }
  if (responseMode === "number") return { payload: { data: { id: payload.sid, status: "success", phone_number: payload.phone_number } }, requestId };
  if (responseMode === "message") return { payload: { data: { id: payload.sid, from: payload.from, to: [{ phone_number: payload.to, status: payload.status }], parts: Number(payload.num_segments || 1) } }, requestId };
  return { payload, requestId };
}

export function twilioNumberResource(numberType) {
  const types = { local: "Local", mobile: "Mobile", toll_free: "TollFree" };
  return types[numberType] || null;
}

export function normalizeAvailableNumber(item, pricing) {
  const providerUpfrontMicros = pricing.numberUpfrontUsdMicros;
  const providerMonthlyMicros = pricing.numberMonthlyUsdMicros;
  const customerUpfrontMicros = retailMicros(providerUpfrontMicros, pricing.grossMarginBps);
  const customerMonthlyMicros = retailMicros(providerMonthlyMicros, pricing.grossMarginBps);
  return {
    phoneNumber: item.phone_number,
    currency: "USD",
    providerUpfrontMicros,
    providerMonthlyMicros,
    customerUpfrontMicros,
    customerMonthlyMicros,
    customerUpfrontCredits: usdToCreditsMicrounits(customerUpfrontMicros, pricing.creditUsdMicros) / 1_000_000,
    customerMonthlyCredits: usdToCreditsMicrounits(customerMonthlyMicros, pricing.creditUsdMicros) / 1_000_000,
    capabilities: item.capabilities || {},
    features: item.features || Object.entries(item.capabilities || {}).filter(([, enabled]) => enabled).map(([name]) => name.toLowerCase()),
  };
}

export function verifyTwilioWebhook({ authToken = process.env.TWILIO_AUTH_TOKEN, signature, url, params }) {
  if (!authToken || !signature || !url) return false;
  const data = `${url}${Object.keys(params || {}).sort().map(key => `${key}${params[key]}`).join("")}`;
  const expected = createHmac("sha1", authToken).update(data).digest("base64");
  const left = Buffer.from(expected);
  const right = Buffer.from(String(signature));
  return left.length === right.length && timingSafeEqual(left, right);
}
