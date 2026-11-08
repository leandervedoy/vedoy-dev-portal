export function openAIConfigured(env = process.env) {
  return Boolean(env.OPENAI_API_KEY || (env.NEON_AI_GATEWAY_TOKEN && env.NEON_AI_GATEWAY_BASE_URL));
}

export async function openAIRequest(path, input, { timeoutMs = 30_000 } = {}) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.NEON_AI_GATEWAY_TOKEN;
  const baseUrl = process.env.OPENAI_BASE_URL || (process.env.NEON_AI_GATEWAY_BASE_URL ? `${process.env.NEON_AI_GATEWAY_BASE_URL.replace(/\/$/, "")}/v1` : "https://api.openai.com/v1");
  if (!apiKey) {
    throw Object.assign(new Error("The model provider is not configured."), { status: 503, code: "model_provider_not_configured" });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw Object.assign(new Error(payload?.error?.message || "The model provider rejected the request."), {
        status: response.status === 429 ? 429 : response.status >= 500 ? 503 : 422,
        code: response.status === 429 ? "model_rate_limited" : "model_provider_error",
      });
    }
    return payload;
  } catch (error) {
    if (error.status) throw error;
    throw Object.assign(new Error("The model provider did not respond in time."), { status: 503, code: "model_provider_unavailable" });
  } finally {
    clearTimeout(timer);
  }
}
