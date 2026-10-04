// 正解の読みの音声を VOICEVOX で生成する(T-004, FR-009)。生成物(public/audio/)はコミットする。
//   docker run -d --name voicevox -p 50021:50021 voicevox/voicevox_engine:cpu-latest
//   npx tsx scripts/build-audio.ts [--grade 3] [--engine http://localhost:50021]
// 既に存在する音声はスキップする。問題データから参照されなくなった音声は削除する。
// AAC への変換に ffmpeg が必要。

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { VOICE } from "../src/audio/voice-config";
import { buildGrade } from "../src/data/content";
import { ROOT, loadContents } from "./data-io";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const ENGINE = arg("--engine") ?? "http://localhost:50021";
const onlyGrade = arg("--grade") ? Number(arg("--grade")) : undefined;
const CONCURRENCY = 3;

type Mora = { text: string };
type AccentPhrase = { moras: Mora[]; accent: number };

const toKatakana = (s: string) => s.replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
/** 「オウ」→「オオ」「エイ」→「エエ」のように、VOICEVOX が長音として解析する表記に揃える */
const normalizeLongVowel = (s: string) =>
  s.replace(/([オコソトノホモヨロゴゾドボポョ])ウ/g, "$1オ").replace(/([エケセテネヘメレゲゼデベペ])イ/g, "$1エ");

/**
 * テキスト解析の結果が読みと一致するか確認し、一致しなければカナ指定で読みを固定する。
 * ひらがな 1 語でも「は」→「ワ」(助詞扱い)や「ここの/つ」(句の分割)になることがあるため(NFR-012)。
 */
async function buildQuery(kana: string) {
  const res = await fetch(`${ENGINE}/audio_query?text=${encodeURIComponent(kana)}&speaker=${VOICE.speaker}`, { method: "POST" });
  if (!res.ok) throw new Error(`audio_query 失敗: ${kana} (${res.status})`);
  const query = await res.json();
  const phrases: AccentPhrase[] = query.accent_phrases;
  const expected = normalizeLongVowel(toKatakana(kana));
  const parsed = normalizeLongVowel(phrases.flatMap((p) => p.moras.map((m) => m.text)).join(""));
  if (phrases.length === 1 && parsed === expected) return query;

  // 1 つのアクセント句として、カナ(AquesTalk 風記法)で指定し直す。アクセント位置は解析結果の先頭句に合わせる
  const moras = expected.match(/.[ャュョァィゥェォ]?/g)!;
  const accent = Math.min(Math.max(phrases[0]?.accent ?? 1, 1), moras.length);
  const text = moras.slice(0, accent).join("") + "'" + moras.slice(accent).join("");
  const fixed = await fetch(`${ENGINE}/accent_phrases?text=${encodeURIComponent(text)}&speaker=${VOICE.speaker}&is_kana=true`, { method: "POST" });
  if (!fixed.ok) throw new Error(`accent_phrases 失敗: ${kana} → ${text} (${fixed.status})`);
  query.accent_phrases = await fixed.json();
  const check = normalizeLongVowel((query.accent_phrases as AccentPhrase[]).flatMap((p) => p.moras.map((m) => m.text)).join(""));
  if (check !== expected) throw new Error(`読みを固定できません: ${kana} → ${check}`);
  corrected.push(`${kana}(${query.kana} → ${text})`);
  return query;
}

const corrected: string[] = [];

async function synthesize(kana: string, dest: string) {
  const query = await buildQuery(kana);
  query.speedScale = VOICE.speedScale;
  query.prePhonemeLength = 0.05;
  query.postPhonemeLength = 0.1;
  const s = await fetch(`${ENGINE}/synthesis?speaker=${VOICE.speaker}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query),
  });
  if (!s.ok) throw new Error(`synthesis 失敗: ${kana} (${s.status})`);
  const wav = `${dest}.wav`;
  writeFileSync(wav, Buffer.from(await s.arrayBuffer()));
  // AAC(.m4a)モノラル 32kbps
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", wav, "-ac", "1", "-ar", "24000", "-c:a", "aac", "-b:a", "32k", "-movflags", "+faststart", dest]);
  rmSync(wav);
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
