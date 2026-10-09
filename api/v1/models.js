import handler from "../[...path].js";

export default function modelsAndPlatformGateway(req, res) {
  const routed = Array.isArray(req.query?.__vedoy_route)
    ? req.query.__vedoy_route.join("/")
    : String(req.query?.__vedoy_route || "").trim();
  if (routed) {
    const clean = routed.replace(/^\/+|\/+$/g, "");
    req.url = `/api/v1/${clean}`;
  }
  return handler(req, res);
}
