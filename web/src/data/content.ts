// 問題データ原稿(content/grade-N.yaml)の型と、原稿 → 配信データへの変換。
// ビルド時のみ使用する(scripts/build-data.ts と検証テスト)。

import { createHash } from "node:crypto";
import { UNIT_SIZE } from "../config";
import type { GradeData, KanjiEntry, Question, Reading, Ruby, UnitInfo } from "./types";

/** 読みの表記: "やま"(音訓は type で指定)、送り仮名は "のぼ(る)" */
export interface ContentReading {
  on?: string;
  kun?: string;
}

export interface ContentWord {
  /** 熟語。未習漢字は {漢字|かな} でルビを付ける */
  word: string;
  /** 熟語全体の読み */
  kana: string;
  /** 出題漢字の読み(readings の表記、または一意に決まる語幹) */
  reading: string;
  distractors: [string, string, string];
}

export interface ContentSentence {
  /** 例文。出題漢字を [ ] で囲む。未習漢字は {漢字|かな} */
  text: string;
  /** 出題漢字の読み(readings の表記と一致させる) */
  reading: string;
  distractors: [string, string, string];
}

export interface ContentKanji {
  kanji: string;
  readings: ContentReading[];
  words?: ContentWord[];
  sentences?: ContentSentence[];
}

export interface GradeContent {
  grade: number;
  kanji: ContentKanji[];
}

/** "のぼ(る)" → { kana: "のぼ", okurigana: "る" } */
export function parseReadingNotation(notation: string): { kana: string; okurigana?: string } {
  const m = notation.match(/^([^()]+)(?:\(([^()]+)\))?$/);
  if (!m) throw new Error(`読みの表記が不正: ${notation}`);
  return m[2] ? { kana: m[1], okurigana: m[2] } : { kana: m[1] };
}

export function readingNotation(r: Pick<Reading, "kana" | "okurigana">): string {
  return r.okurigana ? `${r.kana}(${r.okurigana})` : r.kana;
}

export function fullReading(r: Pick<Reading, "kana" | "okurigana">): string {
  return r.kana + (r.okurigana ?? "");
}

export function audioIdOf(kana: string): string {
  return createHash("sha1").update(`v1:${kana}`).digest("hex").slice(0, 12);
}

/** "{森|もり}の [山]" のような原稿表記から、表示文字列・ルビ・下線範囲を取り出す */
export function parseMarkup(text: string): { prompt: string; ruby: Ruby[]; highlight?: { start: number; length: number } } {
  let prompt = "";
  const ruby: Ruby[] = [];
  let highlight: { start: number; length: number } | undefined;
  const re = /\{([^|}]+)\|([^}]+)\}|\[([^\]]+)\]|([^{[]+)/gu;
  for (const m of text.matchAll(re)) {
    const start = [...prompt].length;
    if (m[1] !== undefined) {
      prompt += m[1];
      ruby.push({ start, length: [...m[1]].length, kana: m[2] });
    } else if (m[3] !== undefined) {
      prompt += m[3];
      highlight = { start, length: [...m[3]].length };
    } else {
      prompt += m[4];
    }
  }
  return { prompt, ruby, highlight };
}

/** 単漢字問題の誤答を同学年の他の漢字の読みから決定的に選ぶ(FR-006) */
function pickSingleDistractors(
  target: Reading,
  ownForms: Set<string>,
  pool: Reading[],
  seed: string,
): [string, string, string] {
  const answer = fullReading(target);
  const candidates = new Map<string, number>();
  for (const r of pool) {
    const form = fullReading(r);
    if (ownForms.has(form) || ownForms.has(r.kana) || form === answer) continue;
    // 音訓・送り仮名の有無・文字数が近いものを優先(「音の似た読み」)
    let score = 0;
    if (r.type === target.type) score += 4;
    if (Boolean(r.okurigana) === Boolean(target.okurigana)) score += 4;
    if (target.okurigana && r.okurigana === target.okurigana) score += 2;
    score -= Math.abs([...form].length - [...answer].length) * 2;
    if (form[0] === answer[0]) score += 1;
    const tiebreak = parseInt(createHash("sha1").update(seed + form).digest("hex").slice(0, 6), 16) / 0xffffff;
    candidates.set(form, Math.max(candidates.get(form) ?? -Infinity, score + tiebreak));
  }
  const picked = [...candidates.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f]) => f);
  if (picked.length < 3) throw new Error(`誤答を 3 つ作れません: ${target.readingId}`);
  return picked as [string, string, string];
}

/** 原稿 → 配信データ(API-002)と単元情報 */
export function buildGrade(content: GradeContent): { data: GradeData; units: UnitInfo[] } {
  const g = content.grade;
  const unitCount = Math.max(1, Math.round(content.kanji.length / UNIT_SIZE));
  const perUnit = Math.ceil(content.kanji.length / unitCount);

  const kanji: KanjiEntry[] = content.kanji.map((k, i) => {
    const unitNo = Math.floor(i / perUnit) + 1;
    return {
      kanji: k.kanji,
      unitId: `g${g}-u${unitNo}`,
      order: i + 1,
      readings: k.readings.map((cr) => {
        const type = cr.on !== undefined ? "on" : "kun";
        const parsed = parseReadingNotation((cr.on ?? cr.kun)!);
        return {
          readingId: `${k.kanji}:${readingNotation(parsed)}`,
          type,
          ...parsed,
        } satisfies Reading;
      }),
    };
  });

  const units: UnitInfo[] = [];
  for (const k of kanji) {
    let u = units.find((x) => x.unitId === k.unitId);
    if (!u) {
      u = { unitId: k.unitId, order: units.length + 1, title: `ステージ ${units.length + 1}`, kanji: [] };
      units.push(u);
    }
    u.kanji.push(k.kanji);
  }

  const pool = kanji.flatMap((k) => k.readings);
  const questions: Question[] = [];

  content.kanji.forEach((ck, i) => {
    const entry = kanji[i];
    const ownForms = new Set(entry.readings.flatMap((r) => [r.kana, fullReading(r)]));
    const findReading = (notation: string) => {
      // 送り仮名付きの表記 "のぼ(る)" か、語幹が一意なら "のぼ" でも指定できる
      const exact = entry.readings.find((x) => readingNotation(x) === notation);
      const byKana = entry.readings.filter((x) => x.kana === notation);
      const r = exact ?? (byKana.length === 1 ? byKana[0] : undefined);
      if (!r) throw new Error(`${ck.kanji}: 読み "${notation}" が readings にありません`);
      return r;
    };

    for (const r of entry.readings) {
      const answer = fullReading(r);
      questions.push({
        questionId: `${r.readingId}:single`,
        kanji: entry.kanji,
        readingId: r.readingId,
        format: "single",
        prompt: entry.kanji + (r.okurigana ?? ""),
        ruby: [],
        highlight: { start: 0, length: 1 },
        hint: r.type === "on" ? "おんよみ" : "くんよみ",
        answer,
        distractors: pickSingleDistractors(r, ownForms, pool, r.readingId),
        audioId: audioIdOf(answer),
      });
    }

    for (const w of ck.words ?? []) {
      const r = findReading(w.reading);
      const { prompt, ruby } = parseMarkup(w.word);
      const idx = [...prompt].indexOf(entry.kanji);
      questions.push({
        questionId: `${r.readingId}:word:${prompt}`,
        kanji: entry.kanji,
        readingId: r.readingId,
        format: "word",
        prompt,
        ruby,
        highlight: { start: idx, length: 1 },
        answer: w.kana,
        distractors: w.distractors,
        audioId: audioIdOf(w.kana),
      });
    }

    (ck.sentences ?? []).forEach((s, n) => {
      const r = findReading(s.reading);
      const { prompt, ruby, highlight } = parseMarkup(s.text);
      if (!highlight) throw new Error(`${ck.kanji}: 例文に [ ] の出題範囲がありません: ${s.text}`);
      questions.push({
        questionId: `${r.readingId}:sentence:${n + 1}`,
        kanji: entry.kanji,
        readingId: r.readingId,
        format: "sentence",
        prompt,
        ruby,
        highlight,
        answer: r.kana,
        distractors: s.distractors,
        audioId: audioIdOf(r.kana),
      });
    });
  });

  return { data: { grade: g, kanji, questions }, units };
}
