// 問題データ原稿(content/)→ 配信データ(public/data/)を生成する。
// 検証エラーがあれば生成せずに終了コード 1 で終了する(NFR-012, NFR-013)。
//   npm run data:build              生成
//   npm run data:build -- --lock    公開済み問題 ID のロックを更新(リリース時)
//   --strict-audio                  音声の欠けをエラーにする(本番ビルドで使用)

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SUPPORTED_SCHEMA_VERSION } from "../src/config";
import { buildGrade } from "../src/data/content";
import type { Manifest } from "../src/data/types";
import { validateGrade } from "../src/data/validate";
import { LOCK_FILE, ROOT, loadContents, loadValidationContext } from "./data-io";

const OUT_DIR = join(ROOT, "public", "data");
const DATA_VERSION = "0.1.0-mvp";

const ctx = loadValidationContext();
const built = loadContents().map((c) => buildGrade(c));
const errors = built.flatMap(({ data }) => validateGrade(data, ctx));
if (errors.length > 0) {
  console.error(`問題データの検証で ${errors.length} 件のエラー:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  process.exit(1);
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const manifest: Manifest = {
  schemaVersion: SUPPORTED_SCHEMA_VERSION,
  dataVersion: DATA_VERSION,
  grades: [],
  removedQuestionIds: ctx.removedQuestionIds ?? [],
};
const strictAudio = process.argv.includes("--strict-audio");
const missingAudio: string[] = [];
for (const { data, units } of built) {
  // すべての問題の正解の読みに音声がある(docs/design/04-functional-spec.mdx 検証項目)
  let audioBytes = 0;
  for (const id of new Set(data.questions.map((q) => q.audioId))) {
    const f = join(ROOT, "public", "audio", String(data.grade), `${id}.m4a`);
    if (existsSync(f)) audioBytes += statSync(f).size;
    else missingAudio.push(`${data.grade}年 ${data.questions.find((q) => q.audioId === id)!.answer}`);
  }
  const json = JSON.stringify(data);
  const hash = createHash("sha256").update(json).digest("hex").slice(0, 10);
  const file = `/data/grade-${data.grade}.${hash}.json`;
  writeFileSync(join(ROOT, "public", file), json);
  manifest.grades.push({ grade: data.grade, file, kanjiCount: data.kanji.length, units, audioBytes });
  console.log(`${data.grade}年: 漢字 ${data.kanji.length} / 読み ${data.kanji.reduce((n, k) => n + k.readings.length, 0)} / 問題 ${data.questions.length} → ${file}`);
}
writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));

if (missingAudio.length > 0) {
  const msg = `読み上げ音声が ${missingAudio.length} 件ありません(npx tsx scripts/build-audio.ts で生成): ${missingAudio.slice(0, 10).join(", ")}${missingAudio.length > 10 ? " ほか" : ""}`;
  if (strictAudio) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(`警告: ${msg}`);
}

if (process.argv.includes("--lock")) {
  const ids = [...new Set([...(ctx.publishedQuestionIds ?? []), ...built.flatMap(({ data }) => data.questions.map((q) => q.questionId))])].sort();
  writeFileSync(LOCK_FILE, JSON.stringify(ids, null, 2) + "\n");
  console.log(`ロックを更新: ${ids.length} 件`);
}
