// next build 後の out/ に Service Worker を生成する(T-002 のフォールバック方式: out/ に injectManifest を適用)

import { rmSync } from "node:fs";
import { join } from "node:path";
import { injectManifest } from "@serwist/build";
import { build } from "esbuild";

const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "out");
const TMP = join(ROOT, ".next", "sw.bundle.js");

await build({
  entryPoints: [join(ROOT, "src/sw/sw.ts")],
  outfile: TMP,
  bundle: true,
  format: "iife",
  minify: true,
  target: "es2020",
  define: { "process.env.NODE_ENV": '"production"' },
});

const { count, size, warnings } = await injectManifest({
  swSrc: TMP,
  swDest: join(OUT, "sw.js"),
  globDirectory: OUT,
  globPatterns: ["**/*.{html,js,css,txt,json,webmanifest,png,svg,ico,woff2}"],
  globIgnores: ["sw.js", "404.html", "_not-found/**"],
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
});
rmSync(TMP);
for (const w of warnings) console.warn(w);
console.log(`Service Worker: ${count} ファイル(${(size / 1024).toFixed(0)} KB)を precache`);
