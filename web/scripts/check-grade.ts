// 1 学年分の原稿だけを検証する(原稿の作成中に使う。ファイルは生成しない)
//   npx tsx scripts/check-grade.ts 3

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { buildGrade, type GradeContent } from "../src/data/content";
import { validateGrade } from "../src/data/validate";
import { CONTENT_DIR, loadValidationContext } from "./data-io";

const grade = Number(process.argv[2]);
const content = parse(readFileSync(join(CONTENT_DIR, `grade-${grade}.yaml`), "utf8")) as GradeContent;
let errors: string[];
try {
  const { data } = buildGrade(content);
  errors = validateGrade(data, loadValidationContext());
  if (errors.length === 0) {
    const readings = data.kanji.reduce((n, k) => n + k.readings.length, 0);
    console.log(`OK ${grade}年: 漢字 ${data.kanji.length} / 読み ${readings} / 問題 ${data.questions.length}`);
    process.exit(0);
  }
} catch (e) {
  errors = [e instanceof Error ? e.message : String(e)];
}
console.error(`NG ${grade}年: ${errors.length} 件\n${errors.map((e) => `  - ${e}`).join("\n")}`);
process.exit(1);
