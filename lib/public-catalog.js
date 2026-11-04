// Public, read-only price/content distribution backed by Supabase RLS.
const SOURCE_URL = process.env.SUPABASE_URL || "https://niedmgyyougvgiiuwcvw.supabase.co";
const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_7PrmP1V4enFECw0jfTAiDw_XAXD-xqd";
const allowed = {
  prices: { table: "vedoy_price_catalog", fields: "code,category,title,description,amount_ore,setup_ore,billing_period,currency,vat_mode,features,featured,sort_order,version,updated_at", filter: "category" },
  content: { table: "vedoy_site_content", fields: "content_key,eyebrow,heading,body,sort_order,version,updated_at", filter: "content_key" }
};
function respond(res, status, body, ttl = 0) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Cache-Control", ttl ? `public, s-maxage=${ttl}, stale-while-revalidate=120` : "no-store");
  res.end(JSON.stringify(body));
}
export async function catalogHandler(req, res, type) {
  if (req.method === "OPTIONS") return respond(res, 204, {});
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET,OPTIONS");
    return respond(res, 405, { error: "method_not_allowed" });
  }
  const configuration = allowed[type];
  if (!configuration || !SOURCE_URL || !PUBLISHABLE_KEY) return respond(res, 503, { error: "catalog_unavailable" });
  const request = new URL(req.url || "/", "https://api.vedoy.local");
  const category = request.searchParams.get(configuration.filter);
  const code = type === "prices" ? request.searchParams.get("code") : null;
  if ((category && !/^[a-z0-9_.-]{2,90}$/.test(category)) || (code && !/^[a-z0-9_-]{2,70}$/.test(code))) {
    return respond(res, 400, { error: "invalid_filter" });
  }
  const endpoint = new URL(`/rest/v1/${configuration.table}`, SOURCE_URL);
  endpoint.searchParams.set("select", configuration.fields);
  endpoint.searchParams.set("published", "eq.true");
  endpoint.searchParams.set("order", "sort_order.asc");
  endpoint.searchParams.set("limit", "250");
  if (category) endpoint.searchParams.set(configuration.filter, `eq.${category}`);
  if (code) endpoint.searchParams.set("code", `eq.${code}`);
  try {
    const upstream = await fetch(endpoint, { headers: { apikey: PUBLISHABLE_KEY, Accept: "application/json" }, signal: AbortSignal.timeout(7000), cache: "no-store" });
    if (!upstream.ok) {
      console.error("Catalog upstream response", upstream.status);
      return respond(res, 503, { error: "catalog_unavailable" });
    }
    const rows = await upstream.json();
    if (!Array.isArray(rows)) return respond(res, 503, { error: "invalid_catalog_response" });
    const data = type === "prices" ? rows.map(row => ({
      code: row.code, category: row.category, title: row.title, description: row.description,
      amountOre: row.amount_ore, setupOre: row.setup_ore, billingPeriod: row.billing_period,
      currency: row.currency, vatMode: row.vat_mode, features: row.features,
      featured: row.featured, version: row.version, updatedAt: row.updated_at
    })) : rows.map(row => ({
      key: row.content_key, eyebrow: row.eyebrow, heading: row.heading,
      body: row.body, version: row.version, updatedAt: row.updated_at
    }));
    return respond(res, 200, { source: "vedoy-developer-portal", version: "v1", [type]: data }, 30);
  } catch (error) {
    console.error("Catalog network error", error instanceof Error ? error.message : "unknown");
    return respond(res, 503, { error: "catalog_unavailable" });
  }
}
