import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

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
  "extension/src/options/options.ts": "options.js"
};

for (const [source, target] of Object.entries(bundles)) {
  const targetPath = join(out, target);
  await mkdir(dirname(targetPath), { recursive: true });
  if (source.endsWith(".ts")) {
    // The build script is intentionally simple for the spike.
    // Production build will use a real bundler and separate chunks.
    const { transform } = await import("esbuild");
    await transform(await (await import("node:fs/promises")).readFile(source, "utf8"), {
      loader: "ts",
      format: "esm",
      target: "es2022",
      outfile: targetPath
    });
  } else {
    await cp(source, targetPath);
  }
}
