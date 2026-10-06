// 九九の唱えの音声(81 本)を VOICEVOX で生成する(FR-029, T-004)。生成物(public/audio/kuku/)はコミットする。
//   docker run -d --name voicevox -p 50021:50021 voicevox/voicevox_engine:cpu-latest
//   npx tsx scripts/build-kuku-audio.ts [--engine http://localhost:50021]
// 既に存在する音声はスキップし、参照されなくなった音声は削除する。生成後は全件を聴取する(NFR-017)。
//
// 唱えは「さざんが」「く」のような独特の区切りがあり、テキスト解析に任せると句が細かく割れたり読みが変わったりする
// (例: 「にく じゅうはち」→「ジュウワ」)。前半(かける数)と後半(積)の 2 句をカナで指定して読みを固定する。

import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { KUKU_FACTS } from "../src/kuku/data";
import { ROOT } from "./data-io";
import { accentPhrasesFromKana, audioQuery, morasOf, splitMoras, synthesizeTo, toKatakana, type AudioQuery } from "./voicevox";

const CONCURRENCY = 3;

/** 1 句のアクセント位置。単独で 1 句に解析できればその位置、できなければ頭高(1) */
async function accentOf(kana: string): Promise<number> {
  const q = await audioQuery(kana);
  const ok = q.accent_phrases.length === 1 && morasOf(q.accent_phrases) === toKatakana(kana);
  return ok ? q.accent_phrases[0].accent : 1;
}

const withAccent = (kana: string, accent: number) => {
  const moras = splitMoras(toKatakana(kana));
  const a = Math.min(Math.max(accent, 1), moras.length);
  return moras.slice(0, a).join("") + "'" + moras.slice(a).join("");
};

async function buildQuery(chant: readonly [string, string]): Promise<AudioQuery> {
  const [left, right] = chant;
  const text = `${withAccent(left, await accentOf(left))}、${withAccent(right, await accentOf(right))}`;
  // 合成パラメータ(音量・抑揚 等)の既定値を得るため、通常の解析結果を土台にしてアクセント句だけ差し替える
  const query = await audioQuery(`${left} ${right}`);
  query.accent_phrases = await accentPhrasesFromKana(text);
  const expected = toKatakana(left + right);
  const got = morasOf(query.accent_phrases);
  if (got !== expected) throw new Error(`読みを固定できません: ${left} ${right} → ${got}`);
  return query;
}

const dir = join(ROOT, "public", "audio", "kuku");
mkdirSync(dir, { recursive: true });
const wanted = new Map(KUKU_FACTS.map((f) => [f.audioId, f]));
for (const f of readdirSync(dir)) {
  if (!wanted.has(f.replace(/\.m4a$/, ""))) rmSync(join(dir, f));
}

const todo = [...wanted.values()].filter((f) => !existsSync(join(dir, `${f.audioId}.m4a`)));
const total = todo.length;
const worker = async () => {
  for (let f = todo.shift(); f; f = todo.shift()) {
    await synthesizeTo(await buildQuery(f.chant), join(dir, `${f.audioId}.m4a`), f.id);
  }
};
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`九九: 音声 ${wanted.size} 本(新規 ${total} 本)`);
