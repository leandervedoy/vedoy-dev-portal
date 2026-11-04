import { catalogHandler } from "../../lib/public-catalog.js";
export default function pricingApi(req, res) { return catalogHandler(req, res, "prices"); }
