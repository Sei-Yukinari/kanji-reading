// docs/ 配下の mdx から mermaid コードブロックを抽出し、SVG に変換して画像参照へ置き換える。
//   node scripts/build-diagrams.mjs            # 抽出 + SVG 生成 + mdx 置換
//   node scripts/build-diagrams.mjs --render   # diagrams/src/*.mmd から SVG を再生成するだけ(置換済み後の更新用)
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname;
const DOCS = join(ROOT, "docs");
const SRC = join(ROOT, "diagrams", "src");
const OUT = join(ROOT, "public", "diagrams");
const MMDC = join(ROOT, "node_modules", ".bin", "mmdc");
const PUPPETEER = join(ROOT, "diagrams", "puppeteer.json");
const CONFIG = join(ROOT, "diagrams", "mermaid.config.json");
const renderOnly = process.argv.includes("--render");

mkdirSync(SRC, { recursive: true });
mkdirSync(OUT, { recursive: true });

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".mdx") ? [p] : [];
  });
}

function render(mmd) {
  const svg = join(OUT, basename(mmd, ".mmd") + ".svg");
  execFileSync(MMDC, ["-i", mmd, "-o", svg, "-c", CONFIG, "-p", PUPPETEER, "-b", "white", "-q"], { stdio: "inherit" });
  return svg;
}

if (renderOnly) {
  for (const f of readdirSync(SRC).filter((n) => n.endsWith(".mmd"))) render(join(SRC, f));
  process.exit(0);
}

const re = /^```mermaid[^\n]*\n([\s\S]*?)^```[ \t]*$/gm;
let total = 0;
for (const file of walk(DOCS)) {
  const text = readFileSync(file, "utf8");
  if (!text.includes("```mermaid")) continue;
  // docs/design/06-sequence-flow.mdx → design-06-sequence-flow / docs/index.mdx → index
  const slug = relative(DOCS, file).replace(/\.mdx$/, "").replace(/\//g, "-");
  let n = 0;
  const next = text.replace(re, (block, body, offset) => {
    n += 1;
    const name = `${slug}-${String(n).padStart(2, "0")}`;
    const mmd = join(SRC, `${name}.mmd`);
    writeFileSync(mmd, body);
    render(mmd);
    // 直前の見出し(### など)を alt テキストにする
    const before = text.slice(0, offset);
    const heading = [...before.matchAll(/^#{1,6}\s+(.+)$/gm)].pop()?.[1]?.trim() ?? slug;
    total += 1;
    console.log(`  ${name}.svg  ← ${heading}`);
    return `![${heading}](/diagrams/${name}.svg)`;
  });
  if (n > 0) writeFileSync(file, next);
}
console.log(`done: ${total} diagrams`);
