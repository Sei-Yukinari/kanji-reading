// 問題データの検証(docs/design/04-functional-spec.mdx「検証スクリプトのチェック項目」)

import { ownReadingForms } from "./content";
import type { GradeData } from "./types";

const HIRAGANA = /^[ぁ-ゖー]+$/u;
const KANJI = /\p{Script=Han}/u;

export interface ValidationContext {
  /** 学年 → 配当漢字(配当表の正本) */
  officialKanji: Record<number, string[]>;
  /** 既存リリースの問題 ID(削除・変更の検出用) */
  publishedQuestionIds?: string[];
  /** 明示的に削除を許可した問題 ID */
  removedQuestionIds?: string[];
}

export function validateGrade(data: GradeData, ctx: ValidationContext): string[] {
  const errors: string[] = [];
  const err = (msg: string) => errors.push(`[${data.grade}年] ${msg}`);

  // 1. 配当表の漢字がすべて揃い、学年・掲載順が正しい
  const official = ctx.officialKanji[data.grade] ?? [];
  const actual = data.kanji.map((k) => k.kanji);
  if (official.join("") !== actual.join("")) {
    const missing = official.filter((k) => !actual.includes(k));
    const extra = actual.filter((k) => !official.includes(k));
    err(`配当漢字と一致しない(不足: ${missing.join("") || "なし"} / 余分: ${extra.join("") || "なし"} / 順序違いの可能性)`);
  }

  // 未習漢字の判定に使う「その学年までに習う漢字」
  const learned = new Set(
    Object.entries(ctx.officialKanji)
      .filter(([g]) => Number(g) <= data.grade)
      .flatMap(([, ks]) => ks),
  );

  // 読みのない漢字は習得判定(全読みが習得済み)が常に真になるため許可しない
  for (const k of data.kanji) if (k.readings.length === 0) err(`読みのない漢字: ${k.kanji}`);

  const ids = new Set<string>();
  const readingsWithQuestion = new Set<string>();
  const readingById = new Map(data.kanji.flatMap((k) => k.readings.map((r) => [r.readingId, { r, k }] as const)));

  for (const q of data.questions) {
    const where = q.questionId;
    if (ids.has(q.questionId)) err(`問題 ID が重複: ${where}`);
    ids.add(q.questionId);

    const ref = readingById.get(q.readingId);
    if (!ref) {
      err(`存在しない読みを参照: ${where}`);
      continue;
    }
    readingsWithQuestion.add(q.readingId);

    // 2. 選択肢 4 つが互いに異なり、正解が誤答に含まれない
    const choices = [q.answer, ...q.distractors];
    if (q.distractors.length !== 3) err(`誤答が 3 件でない: ${where}`);
    if (new Set(choices).size !== choices.length) err(`選択肢が重複: ${where} (${choices.join("/")})`);

    // 3. 選択肢がすべてひらがな
    for (const c of choices) if (!HIRAGANA.test(c)) err(`ひらがな以外の選択肢: ${where} (${c})`);

    // 4. 単漢字問題の誤答に対象漢字の他の読み(出題しない読みを含む)が含まれない
    if (q.format === "single") {
      const own = ownReadingForms(ref.k);
      for (const d of q.distractors) if (own.has(d)) err(`誤答に対象漢字の読みが含まれる: ${where} (${d})`);
    }

    // 5. 出題範囲が出題漢字を指している
    const chars = [...q.prompt];
    const hl = chars.slice(q.highlight.start, q.highlight.start + q.highlight.length).join("");
    if (!hl.includes(q.kanji)) err(`出題範囲が出題漢字を指していない: ${where}`);

    // 6. 問題文中の未習漢字にルビが付いている
    chars.forEach((ch, i) => {
      if (!KANJI.test(ch) || learned.has(ch)) return;
      const covered = q.ruby.some((r) => i >= r.start && i < r.start + r.length);
      if (!covered) err(`未習漢字「${ch}」にルビがない: ${where}`);
    });
  }

  // 7. すべての読みに 1 問以上
  for (const id of readingById.keys()) if (!readingsWithQuestion.has(id)) err(`問題のない読み: ${id}`);

  // 8. 既存リリースの問題 ID が削除・変更されていない
  const removed = new Set(ctx.removedQuestionIds ?? []);
  for (const id of ctx.publishedQuestionIds ?? []) {
    if (!official.includes([...id][0])) continue;
    if (!ids.has(id) && !removed.has(id)) err(`公開済みの問題 ID が消えている: ${id}`);
  }

  return errors;
}
