import handler from "../[...path].js";

export default function modelsAndPlatformGateway(req, res) {
  const routed = Array.isArray(req.query?.__vedoy_route)
    ? req.query.__vedoy_route.join("/")
    : String(req.query?.__vedoy_route || "").trim();
  if (routed) {
    const clean = routed.replace(/^\/+|\/+$/g, "");
    // Preserve client filters when routing through the single Hobby-compatible function.
    const params = new URLSearchParams(req.query || {});
    params.delete("__vedoy_route");
    req.url = `/api/v1/${clean}${params.size ? "?" + params.toString() : ""}`;
  }
  return handler(req, res);
}
