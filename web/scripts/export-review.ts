// 問題データの人手チェック(NFR-012)用に、全問題を CSV に書き出す。
//   npx tsx scripts/export-review.ts [出力先ディレクトリ(既定: review/)]
// 学年ごとに 2 ファイル: 読み一覧(readings)と問題一覧(questions)。Excel / Google スプレッドシートで開ける(UTF-8 BOM 付き)。
// チェック欄(1回目・2回目・指摘)を空で用意してある。
// 九九の唱え(81 式)と語呂合わせ(NFR-017)も kuku-chants.csv / kuku-goro.csv に書き出す。

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildGrade, fullReading } from "../src/data/content";
import { GORO, KUKU_FACTS, TRIANGLES, kukuVoiceUrl } from "../src/kuku/data";
import { ROOT, loadContents } from "./data-io";

const outDir = process.argv[2] ?? join(ROOT, "review");
mkdirSync(outDir, { recursive: true });

const csv = (rows: (string | number)[][]) =>
  "﻿" + rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\r\n") + "\r\n";
const CHECK = ["1回目", "2回目", "指摘"];

for (const content of loadContents()) {
  const { data } = buildGrade(content);
  const readings = data.kanji.flatMap((k) => [
    ...k.readings.map((r) => [k.order, k.kanji, k.unitId, r.type === "on" ? "音" : "訓", fullReading(r), r.okurigana ? `${r.kana}(${r.okurigana})` : r.kana, "出題する", ...CHECK.map(() => "")]),
    ...(k.excludedReadings ?? []).map((n) => [k.order, k.kanji, k.unitId, "", n, n, "出題しない", ...CHECK.map(() => "")]),
  ]);
  writeFileSync(
    join(outDir, `grade-${data.grade}-readings.csv`),
    csv([["順", "漢字", "単元", "音訓", "読み", "表記", "扱い", ...CHECK], ...readings]),
  );

  const label = { word: "熟語", sentence: "文中" } as const;
  const questions = data.questions.map((q) => {
    const rubyText = q.ruby.map((r) => `${[...q.prompt].slice(r.start, r.start + r.length).join("")}=${r.kana}`).join(" ");
    const target = [...q.prompt].slice(q.highlight.start, q.highlight.start + q.highlight.length).join("");
    return [q.questionId, q.kanji, label[q.format], q.prompt, q.format === "sentence" ? target : "", rubyText, q.answer, ...q.distractors, ...CHECK.map(() => "")];
  });
  writeFileSync(
    join(outDir, `grade-${data.grade}-questions.csv`),
    csv([["問題ID", "漢字", "形式", "問題文", "下線", "ルビ", "正解", "誤答1", "誤答2", "誤答3", ...CHECK], ...questions]),
  );
  console.log(`${data.grade}年: 読み ${readings.length} 行 / 問題 ${questions.length} 行`);
}
const chants = KUKU_FACTS.map((f) => [f.id, `${f.a} × ${f.b} = ${f.product}`, f.chant[0], f.chant[1], `public${kukuVoiceUrl(f.audioId)}`, ...CHECK.map(() => "")]);
writeFileSync(join(outDir, "kuku-chants.csv"), csv([["式ID", "式", "唱え(前半)", "唱え(後半)", "音声ファイル", ...CHECK], ...chants]));
const goro = TRIANGLES.filter((t) => GORO[t.id]).map((t) => [t.id, `${t.small} × ${t.large} = ${t.product}`, GORO[t.id], ...CHECK.map(() => "")]);
writeFileSync(join(outDir, "kuku-goro.csv"), csv([["三角ID", "式", "語呂合わせ", ...CHECK], ...goro]));
console.log(`九九: 唱え ${chants.length} 行 / 語呂合わせ ${goro.length} 行`);
console.log(`→ ${outDir}`);
