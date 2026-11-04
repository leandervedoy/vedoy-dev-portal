import { catalogHandler } from "../../lib/public-catalog.js";
export default function siteContentApi(req, res) { return catalogHandler(req, res, "content"); }
