// FR-007 / FR-013 / FR-014: 回答による習得状況・復習対象の更新と、漢字の習得状況の算出

import { MASTERY_STREAK, TIME_ATTACK_PENALTY_MS } from "../config";
import type { GradeData, KanjiEntry } from "../data/types";
import type { AnswerRecord, KanjiStatus, Mode, ReadingProgress, ReviewItem } from "./types";

export function applyAnswerToProgress(
  prev: ReadingProgress | undefined,
  answer: Pick<AnswerRecord, "profileId" | "readingId" | "correct" | "answeredAt">,
  grade: number,
): ReadingProgress {
  const streak = answer.correct ? (prev?.correctStreak ?? 0) + 1 : 0;
  return {
    profileId: answer.profileId,
    readingId: answer.readingId,
    grade,
    correctStreak: streak,
    status: streak >= MASTERY_STREAK ? "mastered" : "learning",
    lastAnsweredAt: answer.answeredAt,
    lastWrongAt: answer.correct ? prev?.lastWrongAt : answer.answeredAt,
  };
}

export interface SessionOutcome {
  /** 更新後の READING_PROGRESS(このセットで回答した読みのみ) */
  progress: ReadingProgress[];
  /** 追加する REVIEW_ITEM */
  reviewAdd: ReviewItem[];
  /** 除去する REVIEW_ITEM の questionId */
  reviewRemove: string[];
}

/** セット完了時に、保存すべき習得状況・復習対象の差分を計算する */
export function computeSessionOutcome(
  mode: Mode,
  grade: number,
  answers: readonly AnswerRecord[],
  progress: ReadonlyMap<string, ReadingProgress>,
): SessionOutcome {
  const next = new Map<string, ReadingProgress>();
  const reviewAdd = new Map<string, ReviewItem>();
  const reviewRemove = new Set<string>();

  for (const a of answers) {
    next.set(a.readingId, applyAnswerToProgress(next.get(a.readingId) ?? progress.get(a.readingId), a, grade));
    if (!a.correct) {
      reviewRemove.delete(a.questionId);
      reviewAdd.set(a.questionId, { profileId: a.profileId, questionId: a.questionId, grade, addedAt: a.answeredAt });
    } else if (mode === "review" && !reviewAdd.has(a.questionId)) {
      reviewRemove.add(a.questionId);
    }
  }
  return { progress: [...next.values()], reviewAdd: [...reviewAdd.values()], reviewRemove: [...reviewRemove] };
}

/** 漢字の習得状況: 全読みが mastered → 習得済み、1 つでも回答済み → 学習中 */
export function kanjiStatus(k: KanjiEntry, progress: ReadonlyMap<string, ReadingProgress>): KanjiStatus {
  const ps = k.readings.map((r) => progress.get(r.readingId));
  if (ps.every((p) => p?.status === "mastered")) return "mastered";
  if (ps.some((p) => p)) return "learning";
  return "new";
}

export interface MasterySummary {
  total: number;
  mastered: number;
  learning: number;
  /** 0〜1 */
  rate: number;
}

export function masterySummary(kanji: readonly KanjiEntry[], progress: ReadonlyMap<string, ReadingProgress>): MasterySummary {
  let mastered = 0;
  let learning = 0;
  for (const k of kanji) {
    const s = kanjiStatus(k, progress);
    if (s === "mastered") mastered++;
    else if (s === "learning") learning++;
  }
  return { total: kanji.length, mastered, learning, rate: kanji.length ? mastered / kanji.length : 0 };
}

export function unitKanji(data: GradeData, unitId: string): KanjiEntry[] {
  return data.kanji.filter((k) => k.unitId === unitId);
}

/** FR-011: タイム = 回答待ち時間の合計 + 不正解ペナルティ */
export function timeAttackTime(answers: readonly Pick<AnswerRecord, "elapsedMs" | "correct">[]): number {
  return answers.reduce((t, a) => t + a.elapsedMs + (a.correct ? 0 : TIME_ATTACK_PENALTY_MS), 0);
}

export function isNewBest(timeMs: number, best: number | undefined): boolean {
  return best === undefined || timeMs < best;
}
