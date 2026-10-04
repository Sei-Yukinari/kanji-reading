// 出題用フォント(T-007: Klee One)を、問題データで使う文字だけにサブセット化して WOFF2 にする。
// 問題データの文字が増えたとき(新しい学年・熟語の追加)に実行し、生成物をコミットする。
//   python3 -m pip install fonttools brotli   # pyftsubset を用意
//   npx tsx scripts/build-font.ts --src /path/to/KleeOne-SemiBold.ttf [--pyftsubset /path/to/pyftsubset]
// 元フォント: https://github.com/google/fonts/tree/main/ofl/kleeone

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildGrade } from "../src/data/content";
import { ROOT, loadContents, loadValidationContext } from "./data-io";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const src = arg("--src");
if (!src) {
  console.error("--src に Klee One の TTF を指定してください");
  process.exit(1);
}
const pyftsubset = arg("--pyftsubset") ?? "pyftsubset";
const OUT = join(ROOT, "public", "fonts", "klee-one-semibold.woff2");

const chars = new Set<string>();
const add = (s: string) => [...s].forEach((c) => chars.add(c));
// かな・英数字・記号はすべて含める
for (let c = 0x3041; c <= 0x30ff; c++) chars.add(String.fromCodePoint(c));
for (let c = 0x21; c <= 0x7e; c++) chars.add(String.fromCodePoint(c));
add("、。・ー「」『』()!?〜… 　");
for (const ks of Object.values(loadValidationContext().officialKanji)) ks.forEach((k) => chars.add(k));
for (const content of loadContents()) {
  const { data } = buildGrade(content);
  for (const q of data.questions) add(q.prompt);
}

const dir = mkdtempSync(join(tmpdir(), "font-"));
const textFile = join(dir, "chars.txt");
writeFileSync(textFile, [...chars].join(""));
execFileSync(pyftsubset, [
  src,
  `--text-file=${textFile}`,
  "--flavor=woff2",
  "--layout-features=*",
  "--no-hinting",
  "--desubroutinize",
  `--output-file=${OUT}`,
]);
rmSync(dir, { recursive: true });
console.log(`${chars.size} 文字 → ${OUT}(${(statSync(OUT).size / 1024).toFixed(0)} KB)`);
