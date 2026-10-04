// FR-002: 出題セットの生成(docs/design/04-functional-spec.mdx)

import { MAX_PER_FORMAT, QUESTIONS_PER_SET } from "../config";
import type { GradeData, Question, QuestionFormat } from "../data/types";
import { shuffle, type Rng } from "./random";
import type { Mode, QuizItem, ReadingProgress, ReviewItem } from "./types";

export interface QuestionSetInput {
  mode: Mode;
  data: GradeData;
  /** practice のみ */
  unitId?: string;
  progress: ReadonlyMap<string, ReadingProgress>;
  reviewItems: readonly ReviewItem[];
  rng?: Rng;
  size?: number;
}

/** 0: 未回答 → 1: 学習中 → 2: 習得済み */
function priorityOf(q: Question, progress: ReadonlyMap<string, ReadingProgress>): number {
  const p = progress.get(q.readingId);
  if (!p) return 0;
  return p.status === "mastered" ? 2 : 1;
}

export function candidatesFor(input: Pick<QuestionSetInput, "mode" | "data" | "unitId" | "reviewItems">): Question[] {
  const { mode, data, unitId, reviewItems } = input;
  if (mode === "practice") {
    const unitKanji = new Set(data.kanji.filter((k) => k.unitId === unitId).map((k) => k.kanji));
    return data.questions.filter((q) => unitKanji.has(q.kanji));
  }
  if (mode === "review") {
    const ids = new Set(reviewItems.filter((r) => r.grade === data.grade).map((r) => r.questionId));
    return data.questions.filter((q) => ids.has(q.questionId));
  }
  return data.questions;
}

/** 並び順の優先度に従い、同じ漢字が重複せず 1 形式が上限を超えないように選ぶ */
function pick(ordered: Question[], size: number): Question[] {
  const picked: Question[] = [];
  const usedKanji = new Set<string>();
  const perFormat: Record<QuestionFormat, number> = { word: 0, sentence: 0 };
  const pickedIds = new Set<string>();

  const pass = (strictKanji: boolean, strictFormat: boolean) => {
    for (const q of ordered) {
      if (picked.length >= size) return;
      if (pickedIds.has(q.questionId)) continue;
      if (strictKanji && usedKanji.has(q.kanji)) continue;
      if (strictFormat && perFormat[q.format] >= MAX_PER_FORMAT) continue;
      picked.push(q);
      pickedIds.add(q.questionId);
      usedKanji.add(q.kanji);
      perFormat[q.format]++;
    }
  };
  // 候補が少ない場合(ふくしゅう等)は制約を順に緩めて問題数を確保する
  pass(true, true);
  pass(true, false);
  pass(false, false);
  return picked;
}

export function buildQuestionSet(input: QuestionSetInput): QuizItem[] {
  const rng = input.rng ?? Math.random;
  const size = input.size ?? QUESTIONS_PER_SET;
  const candidates = shuffle(candidatesFor(input), rng);

  let ordered: Question[];
  if (input.mode === "time_attack") {
    // 公平な記録比較のため優先度を使わず完全ランダム
    ordered = candidates;
  } else {
    const lastWrong = (q: Question) => input.progress.get(q.readingId)?.lastWrongAt ?? 0;
    ordered = candidates
      .map((q, i) => ({ q, i, p: priorityOf(q, input.progress) }))
      // 優先度順。学習中は直近の不正解が新しいものを先に。同順位はシャッフル順を保つ
      .sort((a, b) => a.p - b.p || (a.p === 1 ? lastWrong(b.q) - lastWrong(a.q) : 0) || a.i - b.i)
      .map((x) => x.q);
  }

  return shuffle(pick(ordered, size), rng).map((question) => ({
    question,
    choices: shuffle([question.answer, ...question.distractors], rng),
  }));
}
