// 正解の読みの音声を VOICEVOX で生成する(T-004, FR-009)。生成物(public/audio/)はコミットする。
//   docker run -d --name voicevox -p 50021:50021 voicevox/voicevox_engine:cpu-latest
//   npx tsx scripts/build-audio.ts [--grade 3] [--engine http://localhost:50021]
// 既に存在する音声はスキップする。問題データから参照されなくなった音声は削除する。
// AAC への変換に ffmpeg が必要。

import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { buildGrade } from "../src/data/content";
import { ROOT, loadContents } from "./data-io";
import { accentPhrasesFromKana, arg, audioQuery, morasOf, normalizeLongVowel, splitMoras, synthesizeTo, toKatakana } from "./voicevox";

const onlyGrade = arg("--grade") ? Number(arg("--grade")) : undefined;
const CONCURRENCY = 3;

/**
 * テキスト解析の結果が読みと一致するか確認し、一致しなければカナ指定で読みを固定する。
 * ひらがな 1 語でも「は」→「ワ」(助詞扱い)や「ここの/つ」(句の分割)になることがあるため(NFR-012)。
 */
async function buildQuery(kana: string) {
  const query = await audioQuery(kana);
  const phrases = query.accent_phrases;
  const expected = normalizeLongVowel(toKatakana(kana));
  const parsed = normalizeLongVowel(morasOf(phrases));
  if (phrases.length === 1 && parsed === expected) return query;

  // 1 つのアクセント句として、カナ(AquesTalk 風記法)で指定し直す。アクセント位置は解析結果の先頭句に合わせる。
  // 長音に揃える前の表記を使う(「こううん」を「コオウン」にすると、続く「ウ」まで長音と解釈されて「コオオン」になるため)
  const moras = splitMoras(toKatakana(kana));
  const accent = Math.min(Math.max(phrases[0]?.accent ?? 1, 1), moras.length);
  const text = moras.slice(0, accent).join("") + "'" + moras.slice(accent).join("");
  query.accent_phrases = await accentPhrasesFromKana(text);
  const check = normalizeLongVowel(morasOf(query.accent_phrases));
  if (check !== expected) throw new Error(`読みを固定できません: ${kana} → ${check}`);
  corrected.push(`${kana}(${query.kana} → ${text})`);
  return query;
}

const corrected: string[] = [];

async function synthesize(kana: string, dest: string) {
  await synthesizeTo(await buildQuery(kana), dest, kana);
}

for (const content of loadContents()) {
  if (onlyGrade !== undefined && content.grade !== onlyGrade) continue;
  const { data } = buildGrade(content);
  const dir = join(ROOT, "public", "audio", String(data.grade));
  mkdirSync(dir, { recursive: true });

  const wanted = new Map<string, string>();
  for (const q of data.questions) wanted.set(q.audioId, q.answer);

  // 参照されなくなった音声を削除
  for (const f of readdirSync(dir)) {
    if (!wanted.has(f.replace(/\.m4a$/, ""))) rmSync(join(dir, f));
  }

  const todo = [...wanted].filter(([id]) => !existsSync(join(dir, `${id}.m4a`)));
  let done = 0;
  const worker = async () => {
    for (let item = todo.shift(); item; item = todo.shift()) {
      const [id, kana] = item;
      await synthesize(kana, join(dir, `${id}.m4a`));
      if (++done % 100 === 0) console.log(`  ${data.grade}年: ${done} 本 生成`);
    }
  };
  const total = todo.length;
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`${data.grade}年: 音声 ${wanted.size} 本(新規 ${total} 本)`);
}
if (corrected.length) console.log(`カナ指定で読みを固定した音声 ${corrected.length} 本:\n  ${corrected.join("\n  ")}`);
