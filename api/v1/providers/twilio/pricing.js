// Read-only Twilio price adapter. No number provisioning or customer billing.
const countries = new Set(['NO', 'US', 'CA']);
const types = new Set(['local', 'mobile', 'tollFree']);
let cache = new Map();
export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'method_not_allowed' }); }
  const country = String(req.query.country || 'NO').toUpperCase();
  if (!countries.has(country)) return res.status(400).json({ error: 'unsupported_country' });
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const key = process.env.TWILIO_API_KEY;
  const secret = process.env.TWILIO_API_SECRET;
  if (!sid || !key || !secret) return res.status(503).json({ error: 'twilio_not_configured' });
  const existing = cache.get(country);
  if (existing && existing.expires > Date.now()) return res.status(200).json(existing.payload);
  try {
    const response = await fetch('https://pricing.twilio.com/v1/PhoneNumbers/Countries/' + country, {
      headers: { Authorization: 'Basic ' + Buffer.from(key + ':' + secret).toString('base64'), Accept: 'application/json' },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error('provider_failed');
    const raw = await response.json();
    const prices = (raw.phoneNumberPrices || []).flatMap(item => {
      const kind = String(item.numberType || '').toLowerCase().replace(/\\s+/g, '');
      const type = kind === 'tollfree' ? 'tollFree' : kind;
      const cost = Number(item.currentPrice ?? item.basePrice);
      if (!types.has(type) || !Number.isFinite(cost) || cost < 0) return [];
      const currency = String(item.priceUnit || raw.priceUnit || 'USD').toUpperCase();
      if (!/^[A-Z]{3}$/.test(currency)) return [];
      return [{ type, currency, providerMonthly: cost.toFixed(2), customerMonthly: (Math.ceil(cost / 0.8 * 100) / 100).toFixed(2) }];
    });
    const payload = { provider: 'twilio', country, marginPercent: 20, prices, fetchedAt: new Date().toISOString(), purchaseEnabled: false, disclaimer: 'Monthly number rental only. Usage, taxes and compliance fees are excluded.' };
    cache.set(country, { payload, expires: Date.now() + 300000 });
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return res.status(200).json(payload);
  } catch { return res.status(503).json({ error: 'twilio_pricing_unavailable' }); }
}
