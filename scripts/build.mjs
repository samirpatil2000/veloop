import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { build } from "esbuild";

const out = "dist";
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

await cp("manifest.json", join(out, "manifest.json"));
await cp("extension/src/offscreen/offscreen.html", join(out, "offscreen.html"));

const bundles = {
  "extension/src/background/service-worker.ts": "background.js",
  "extension/src/content/bridge.ts": "content.js",
  "extension/src/page/page-bridge.ts": "page-bridge.js",
  "extension/src/offscreen/offscreen.ts": "offscreen.js",
  "extension/src/popup/popup.html": "popup.html",
  "extension/src/popup/popup.css": "popup.css",
  "extension/src/popup/popup.ts": "popup.js",
  "extension/src/options/options.html": "options.html",
  "extension/src/options/options.css": "options.css",
  "extension/src/options/options.ts": "options.js"
};

for (const [source, target] of Object.entries(bundles)) {
  const targetPath = join(out, target);
  await mkdir(dirname(targetPath), { recursive: true });
  if (source.endsWith(".ts")) {
    await build({
      entryPoints: [source],
      outfile: targetPath,
      bundle: true,
      format: "esm",
      target: "es2022",
    });
  } else {
    await cp(source, targetPath);
  }
}
