// VOICEVOX エンジンでの音声生成の共通処理(T-004)。scripts/build-audio.ts と scripts/build-kuku-audio.ts で共用する。
// AAC への変換に ffmpeg が必要。

import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { VOICE } from "../src/audio/voice-config";

export type Mora = { text: string };
export type AccentPhrase = { moras: Mora[]; accent: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AudioQuery = { accent_phrases: AccentPhrase[]; kana: string; [k: string]: any };

export const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
export const ENGINE = arg("--engine") ?? "http://localhost:50021";

export const toKatakana = (s: string) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
/** 「オウ」→「オオ」「エイ」→「エエ」のように、VOICEVOX が長音として解析する表記に揃える */
export const normalizeLongVowel = (s: string) =>
  s.replace(/([オコソトノホモヨロゴゾドボポョ])ウ/g, "$1オ").replace(/([エケセテネヘメレゲゼデベペ])イ/g, "$1エ");
/** カタカナをモーラ単位に分ける(拗音は前の文字と 1 モーラ) */
export const splitMoras = (kata: string) => kata.match(/.[ャュョァィゥェォ]?/g)!;
export const morasOf = (phrases: AccentPhrase[]) => phrases.flatMap((p) => p.moras.map((m) => m.text)).join("");

export async function audioQuery(text: string): Promise<AudioQuery> {
  const res = await fetch(`${ENGINE}/audio_query?text=${encodeURIComponent(text)}&speaker=${VOICE.speaker}`, { method: "POST" });
  if (!res.ok) throw new Error(`audio_query 失敗: ${text} (${res.status})`);
  return res.json();
}

/** カナ(AquesTalk 風記法: アクセント位置に ' 、句の区切りに 、)からアクセント句を作る */
export async function accentPhrasesFromKana(text: string): Promise<AccentPhrase[]> {
  const res = await fetch(`${ENGINE}/accent_phrases?text=${encodeURIComponent(text)}&speaker=${VOICE.speaker}&is_kana=true`, { method: "POST" });
  if (!res.ok) throw new Error(`accent_phrases 失敗: ${text} (${res.status})`);
  return res.json();
}

/** 音声を合成して AAC(.m4a)モノラル 32kbps で保存する */
export async function synthesizeTo(query: AudioQuery, dest: string, label: string) {
  query.speedScale = VOICE.speedScale;
  query.prePhonemeLength = 0.05;
  query.postPhonemeLength = 0.1;
  const s = await fetch(`${ENGINE}/synthesis?speaker=${VOICE.speaker}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query),
  });
  if (!s.ok) throw new Error(`synthesis 失敗: ${label} (${s.status})`);
  const wav = `${dest}.wav`;
  writeFileSync(wav, Buffer.from(await s.arrayBuffer()));
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", wav, "-ac", "1", "-ar", "24000", "-c:a", "aac", "-b:a", "32k", "-movflags", "+faststart", dest]);
  rmSync(wav);
}
