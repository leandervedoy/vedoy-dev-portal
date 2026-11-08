import { cp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Keep the public console and documentation as separate entrypoints.
// Preserve the full legacy documentation at /reference/ for existing deep links.
const assets = [
  "styles.css", "app-modules.css", "portal-shell.css",
  "app.js", "auth.css", "auth.js", "access.js", "developer-console.js",
  "app-modules.js", "console-app.js", "supabase-config.js", "openapi.yaml", "robots.txt", "sitemap.xml"
];
await rm("public", {recursive:true, force:true});
await mkdir("public", {recursive:true});
await Promise.all(assets.map(file => cp(file, join("public",file))));
await Promise.all(["assets","icons"].map(folder=>cp(folder,join("public",folder),{recursive:true})));

await cp("portal-home.html","public/index.html");
await mkdir("public/console",{recursive:true});
await mkdir("public/docs",{recursive:true});
await mkdir("public/reference",{recursive:true});
await cp("console.html","public/console/index.html");
await cp("docs.html","public/docs/index.html");

// Original docs are not a console and must not be shown as the main homepage.
// Absolute asset paths are needed now that the reference is served from /reference/.
const legacy = await readFile("index.html","utf8");
const fixed = legacy.replace(/(src|href)="(?!\/|https?:|mailto:|tel:|#|data:)([^"]+)"/g,(_match,attr,url)=>attr+'="/'+url+'"');
await writeFile("public/reference/index.html",fixed,"utf8");
