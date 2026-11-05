// Vedøy Deliver provider catalogue and guarded Wolt Drive shipment promises.
// Never expose carrier credentials to browsers or forward arbitrary upstream URLs.
const providers = Object.freeze([
  { id: "wolt-drive", name: "Wolt Drive", kind: "on_demand", modes: ["courier", "same_day"], operations: ["quote", "delivery", "tracking"], docsUrl: "https://developer.wolt.com/docs/wolt-drive/endpoints", note: "Merchant agreement, venue ID and regional coverage required." },
  { id: "bring", name: "Bring", kind: "carrier", modes: ["parcel", "courier", "same_day"], operations: ["rates", "booking", "tracking"], docsUrl: "https://developer.bring.com/api/booking/", note: "Mybring account, API key and eligible service agreement required." },
  { id: "helthjem", name: "Helthjem", kind: "carrier", modes: ["parcel", "home_delivery"], operations: ["coverage", "booking", "labels", "tracking"], docsUrl: "https://developer.helthjem.no/", note: "Helthjem customer agreement and API credentials required." },
  { id: "postnord", name: "PostNord", kind: "carrier", modes: ["parcel", "home_delivery"], operations: ["rates", "booking", "pickup", "tracking"], docsUrl: "https://developer.postnord.no/browse-api/api-information/transport-booking-v2", note: "Customer agreement and booking API credentials required." },
  { id: "porterbuddy", name: "Porterbuddy", kind: "on_demand", modes: ["home_delivery"], operations: ["delivery"], docsUrl: "https://porterbuddy.com/", note: "Partner access, supported cities and integration method must be confirmed." },
  { id: "nshift", name: "nShift", kind: "aggregator", modes: ["parcel", "home_delivery"], operations: ["rates", "booking", "tracking", "returns"], docsUrl: "https://nshift.com/delivery-management-platform/apis", note: "Requires an nShift contract and account-specific carrier agreements." },
  { id: "foodora", name: "foodora Partner API", kind: "partner_platform", modes: ["marketplace_orders"], operations: ["catalog", "orders", "order_status"], docsUrl: "https://developer.foodora.com/api-specifications", note: "Partner API handles orders on foodora; independent courier booking is not documented." },
  { id: "uber-direct", name: "Uber Direct", kind: "on_demand", modes: ["courier"], operations: ["delivery", "tracking"], docsUrl: "https://developer.uber.com/docs/deliveries", note: "Not currently available for deliveries in Norway; do not route Norwegian shipments here." }
]);

export function woltQuoteReady(env = process.env) {
  return Boolean(env.WOLT_DRIVE_API_KEY && env.WOLT_DRIVE_VENUE_ID &&
    (env.WOLT_DRIVE_ENV !== "production" || env.WOLT_DRIVE_LIVE_QUOTES_ENABLED === "true"));
}

export function deliveryProviders(env = process.env) {
  return providers.map(provider => ({
    ...provider,
    apiStatus: provider.id === "wolt-drive"
      ? (woltQuoteReady(env) ? "quote_ready" : "setup_required")
      : "documentation_only",
    quoteEnabled: provider.id === "wolt-drive" && woltQuoteReady(env),
    bookingEnabled: false,
    coverageVerified: false
  }));
}

function error(message, status, code) {
  return Object.assign(new Error(message), { status, code });
}

function text(value, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function woltPromiseBody(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      JSON.stringify(input).length > 8192) {
    throw error("A compact JSON quote request is required.", 422, "invalid_delivery_quote");
  }
  const dropoff = input.dropoff;
  if (!dropoff || typeof dropoff !== "object" || Array.isArray(dropoff)) {
    throw error("dropoff is required.", 422, "invalid_dropoff");
  }
  const street = text(dropoff.street, 180);
  const city = text(dropoff.city, 100);
  const postCode = text(dropoff.postCode, 32);
  if (!street || (!city && !postCode)) {
    throw error("dropoff.street and dropoff.city or dropoff.postCode are required for a binding promise.", 422, "invalid_dropoff");
  }
  const minutes = input.preparationMinutes == null ? 30 : Number(input.preparationMinutes);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 60) {
    throw error("preparationMinutes must be 0–60.", 422, "invalid_preparation_minutes");
  }
  const request = { street, city, post_code: postCode, min_preparation_time_minutes: minutes };
  if (dropoff.latitude != null || dropoff.longitude != null) {
    const lat = Number(dropoff.latitude), lon = Number(dropoff.longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 ||
        !Number.isFinite(lon) || lon < -180 || lon > 180) {
      throw error("Both valid latitude and longitude are required.", 422, "invalid_coordinates");
    }
    request.lat = lat;
    request.lon = lon;
  }
  if (input.scheduledDropoffTime != null) {
    const time = text(input.scheduledDropoffTime, 64);
    if (!time || !Number.isFinite(Date.parse(time))) {
      throw error("scheduledDropoffTime must be an ISO 8601 date-time.", 422, "invalid_delivery_time");
    }
    request.scheduled_dropoff_time = new Date(time).toISOString();
  }
  return request;
}

export async function requestWoltQuote(input, { env = process.env, fetcher = fetch } = {}) {
  const request = woltPromiseBody(input);
  if (!woltQuoteReady(env)) {
    throw error("Wolt Drive quotes require a merchant token, venue ID and an enabled environment.", 503, "delivery_provider_not_configured");
  }
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(env.WOLT_DRIVE_VENUE_ID)) {
    throw error("The Wolt venue configuration is invalid.", 503, "delivery_provider_not_configured");
  }
  const host = env.WOLT_DRIVE_ENV === "production"
    ? "https://daas-public-api.wolt.com"
    : "https://daas-public-api.development.dev.woltapi.com";
  let response;
  try {
    response = await fetcher(host + "/v1/venues/" + encodeURIComponent(env.WOLT_DRIVE_VENUE_ID) + "/shipment-promises", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + env.WOLT_DRIVE_API_KEY,
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(7500)
    });
  } catch {
    throw error("Wolt Drive is temporarily unavailable.", 502, "delivery_provider_unavailable");
  }
  if (!response.ok) {
    throw error("Wolt Drive could not provide a shipment promise.", 502, "delivery_provider_rejected_quote");
  }
  let payload;
  try { payload = await response.json(); }
  catch { throw error("Wolt Drive returned an invalid response.", 502, "invalid_delivery_provider_response"); }
  if (!payload || typeof payload.id !== "string" || !payload.price ||
      typeof payload.price.amount !== "number" || typeof payload.price.currency !== "string") {
    throw error("Wolt Drive returned an incomplete promise.", 502, "invalid_delivery_provider_response");
  }
  return {
    provider: "wolt-drive",
    quoteId: payload.id,
    binding: payload.is_binding === true,
    expiresAt: payload.valid_until || null,
    price: { amount: payload.price.amount, currency: payload.price.currency, amountFormat: "provider_native" },
    etaMinutes: Number.isFinite(payload.dropoff?.eta_minutes) ? payload.dropoff.eta_minutes : null,
    environment: env.WOLT_DRIVE_ENV === "production" ? "production" : "development",
    bookingEnabled: false,
    notice: "Provider estimate only; not a Vedøy checkout price or a confirmed delivery."
  };
}
