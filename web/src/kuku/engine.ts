// 九九の出題エンジン(FR-027, FR-030, FR-033)。出題セットの生成・4 択の選択肢・正誤と速さの判定・習得状況と復習対象の更新

import { KUKU_MASTERY_STREAK, KUKU_QUESTIONS_PER_SET, KUKU_SLOW_MS, TIME_ATTACK_PENALTY_MS } from "../config";
import type { Mode } from "../engine/types";
import { shuffle, type Rng } from "../engine/random";
import { DANS, FACT_BY_ID, KUKU_FACTS, type KukuFact } from "./data";

/**
 * 出題の見せ方と、隠す場所。
 * - expr + top: 式(3 × 4 = ?)
 * - expr + left / right: 積から因数(? × 4 = 12 / 3 × ? = 12)
 * - triangle: 三角視算表の 1 か所を「?」にする(2〜9 の段のみ)
 */
export type KukuFormat = "expr" | "triangle";
export type KukuHidden = "top" | "left" | "right";

export interface KukuQuestion {
  factId: string;
  format: KukuFormat;
  hidden: KukuHidden;
  answer: number;
  /** 4 択の選択肢(正解 1 + 誤答 3、シャッフル済み) */
  choices: number[];
}

export const CHOICE_COUNT = 4;

export type KukuOrder = "sequential" | "random";

export interface KukuConfig {
  mode: Mode;
  /** 選んだ段(ふくしゅうでは使わない) */
  dans: number[];
  order: KukuOrder;
}

export type AnswerMethod = "choice" | "voice";

export interface KukuAnswer {
  profileId: string;
  question: KukuQuestion;
  /** 回答した数 */
  given: number;
  correct: boolean;
  /** 正解だが時間がかかった */
  slow: boolean;
  method: AnswerMethod;
  elapsedMs: number;
  answeredAt: number;
}

export type KukuStatus = "learning" | "mastered";

export interface KukuProgress {
  profileId: string;
  factId: string;
  /** 速い正解の連続数 */
  fastStreak: number;
  status: KukuStatus;
  lastAnsweredAt: number;
}

export interface KukuReviewItem {
  profileId: string;
  factId: string;
  reason: "wrong" | "slow";
  addedAt: number;
}

export interface KukuBest {
  profileId: string;
  dansKey: string;
  timeMs: number;
  achievedAt: number;
}

/** 全体図の 1 マスの状態 */
export type CellStatus = "new" | "learning" | "mastered" | "review";

export function answerOf(f: KukuFact, hidden: KukuHidden): number {
  return hidden === "top" ? f.product : hidden === "left" ? f.a : f.b;
}

/**
 * 誤答 3 つ(FR-030)。紛らわしいものを優先する:
 * - 積を答える問題: 九九表で隣り合う積(a×(b±1)・(a±1)×b)→ 積 ±1・±10
 * - かける数を答える問題: 正解に近い 1〜9 の数
 */
export function distractorsOf(f: KukuFact, hidden: KukuHidden, rng: Rng): number[] {
  const answer = answerOf(f, hidden);
  const pick = (groups: number[][]) => {
    const out: number[] = [];
    for (const g of groups) {
      for (const n of shuffle(g, rng)) {
        if (out.length >= CHOICE_COUNT - 1) return out;
        if (n > 0 && n !== answer && !out.includes(n)) out.push(n);
      }
    }
    return out;
  };
  if (hidden === "top") {
    const { a, b, product } = f;
    const neighbors = [[a - 1, b], [a + 1, b], [a, b - 1], [a, b + 1]].filter(([x, y]) => x >= 1 && x <= 9 && y >= 1 && y <= 9).map(([x, y]) => x * y);
    return pick([neighbors, [product - 1, product + 1, product - 10, product + 10], [product + 2, product + 3, product + 5]]);
  }
  const near = (d: number) => [answer - d, answer + d].filter((n) => n >= 1 && n <= 9);
  return pick([near(1), near(2), near(3), near(4), [1, 2, 3, 4, 5, 6, 7, 8, 9]]);
}

export function makeQuestion(f: KukuFact, format: KukuFormat, hidden: KukuHidden, rng: Rng = Math.random): KukuQuestion {
  if (format === "triangle" && !f.triangleId) throw new Error(`1 の段は三角で出題できません: ${f.id}`);
  const answer = answerOf(f, hidden);
  return { factId: f.id, format, hidden, answer, choices: shuffle([answer, ...distractorsOf(f, hidden, rng)], rng) };
}

/** バラバラ出題の形式: 式 4 割・三角 3.5 割・積から因数 2.5 割(三角にできない 1 の段は式) */
export function randomQuestion(f: KukuFact, rng: Rng): KukuQuestion {
  const r = rng();
  const side = (): KukuHidden => (rng() < 0.5 ? "left" : "right");
  if (r < 0.35 && f.triangleId) {
    const h = rng();
    return makeQuestion(f, "triangle", h < 0.5 ? "top" : side(), rng);
  }
  if (r >= 0.75) return makeQuestion(f, "expr", side(), rng);
  return makeQuestion(f, "expr", "top", rng);
}

/** 段の組み合わせの記録キー(自己ベスト用)。例: "1-9"(ぜんぶ)/ "3,4" */
export function dansKeyOf(dans: readonly number[]): string {
  const sorted = [...new Set(dans)].sort((x, y) => x - y);
  return sorted.length === DANS.length ? "1-9" : sorted.join(",");
}

export interface BuildKukuSetInput {
  config: KukuConfig;
  progress: ReadonlyMap<string, KukuProgress>;
  reviewItems: readonly KukuReviewItem[];
  rng?: Rng;
}

/** 出題セットを作る(FR-027) */
export function buildKukuSet({ config, progress, reviewItems, rng = Math.random }: BuildKukuSetInput): KukuQuestion[] {
  if (config.mode === "review") {
    const facts = reviewItems.map((r) => FACT_BY_ID.get(r.factId)).filter((f): f is KukuFact => !!f);
    return shuffle(facts, rng).slice(0, KUKU_QUESTIONS_PER_SET).map((f) => randomQuestion(f, rng));
  }
  const dans = new Set(config.dans);
  const facts = KUKU_FACTS.filter((f) => dans.has(f.a));
  if (config.mode === "practice" && config.order === "sequential") {
    // 暗唱の順(段の小さい順、かける数の小さい順)
    return facts.map((f) => makeQuestion(f, "expr", "top", rng));
  }
  let picked = shuffle(facts, rng);
  if (config.mode === "practice") {
    // まだ習得していない式を優先する(並びは崩さないよう安定ソート)
    picked = picked.sort((x, y) => Number(progress.get(x.id)?.status === "mastered") - Number(progress.get(y.id)?.status === "mastered"));
    picked = shuffle(picked.slice(0, KUKU_QUESTIONS_PER_SET), rng);
  }
  return picked.slice(0, KUKU_QUESTIONS_PER_SET).map((f) => randomQuestion(f, rng));
}

export function isSlow(elapsedMs: number, method: AnswerMethod): boolean {
  return elapsedMs > KUKU_SLOW_MS[method];
}

export interface KukuSessionOutcome {
  progress: KukuProgress[];
  reviewAdd: KukuReviewItem[];
  /** 除去する復習対象の factId */
  reviewRemove: string[];
}

/** セット完了時に、保存すべき習得状況・復習対象の差分を計算する(FR-033) */
export function computeKukuOutcome(
  mode: Mode,
  answers: readonly KukuAnswer[],
  progress: ReadonlyMap<string, KukuProgress>,
): KukuSessionOutcome {
  const next = new Map<string, KukuProgress>();
  const reviewAdd = new Map<string, KukuReviewItem>();
  const reviewRemove = new Set<string>();
  for (const a of answers) {
    const id = a.question.factId;
    const prev = next.get(id) ?? progress.get(id);
    const fast = a.correct && !a.slow;
    const streak = fast ? (prev?.fastStreak ?? 0) + 1 : 0;
    next.set(id, {
      profileId: a.profileId,
      factId: id,
      fastStreak: streak,
      status: streak >= KUKU_MASTERY_STREAK ? "mastered" : "learning",
      lastAnsweredAt: a.answeredAt,
    });
    if (!fast) {
      reviewRemove.delete(id);
      reviewAdd.set(id, { profileId: a.profileId, factId: id, reason: a.correct ? "slow" : "wrong", addedAt: a.answeredAt });
    } else if (mode === "review" && !reviewAdd.has(id)) {
      reviewRemove.add(id);
    }
  }
  return { progress: [...next.values()], reviewAdd: [...reviewAdd.values()], reviewRemove: [...reviewRemove] };
}

/** 全体図の 1 マス(三角や 1 の段のマス)の状態。要復習 > 習得 > 学習中 > 未学習 */
export function cellStatus(
  facts: readonly KukuFact[],
  progress: ReadonlyMap<string, KukuProgress>,
  reviewIds: ReadonlySet<string>,
): CellStatus {
  if (facts.some((f) => reviewIds.has(f.id))) return "review";
  if (facts.every((f) => progress.get(f.id)?.status === "mastered")) return "mastered";
  if (facts.some((f) => progress.has(f.id))) return "learning";
  return "new";
}

/** タイムアタックのタイム: 回答時間の合計 + 不正解 1 問につきペナルティ(FR-011) */
export function kukuTimeAttackTime(answers: readonly KukuAnswer[]): number {
  return answers.reduce((t, a) => t + a.elapsedMs + (a.correct ? 0 : TIME_ATTACK_PENALTY_MS), 0);
}
