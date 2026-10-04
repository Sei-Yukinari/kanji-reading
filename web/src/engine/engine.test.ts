import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { MAX_PER_FORMAT, MASTERY_STREAK, QUESTIONS_PER_SET, TIME_ATTACK_PENALTY_MS } from "../config";
import { buildGrade, type GradeContent } from "../data/content";
import { evaluateMedals, streakDays } from "./medals";
import { applyAnswerToProgress, computeSessionOutcome, kanjiStatus, masterySummary, timeAttackTime } from "./progress";
import { buildQuestionSet } from "./question-set";
import { seededRng } from "./random";
import type { AnswerRecord, ReadingProgress, ReviewItem, SessionRecord } from "./types";

const content = parse(readFileSync(join(import.meta.dirname, "../../content/grade-1.yaml"), "utf8")) as GradeContent;
const data = buildGrade(content).data;
const P = "p1";

const progressOf = (entries: ReadingProgress[]) => new Map(entries.map((p) => [p.readingId, p]));
const prog = (readingId: string, status: "learning" | "mastered", extra: Partial<ReadingProgress> = {}): ReadingProgress => ({
  profileId: P, readingId, grade: 1, correctStreak: status === "mastered" ? 3 : 1, status, lastAnsweredAt: 1, ...extra,
});
const answer = (questionId: string, correct: boolean, at = 1000): AnswerRecord => {
  const q = data.questions.find((x) => x.questionId === questionId)!;
  return { profileId: P, questionId, readingId: q.readingId, kanji: q.kanji, chosen: correct ? q.answer : q.distractors[0], correct, elapsedMs: 2000, answeredAt: at };
};

describe("出題セットの生成(FR-002)", () => {
  it("れんしゅうは単元の漢字から 10 問、漢字の重複なし、1 形式 6 問以内", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const set = buildQuestionSet({ mode: "practice", data, unitId: "g1-u1", progress: new Map(), reviewItems: [], rng: seededRng(seed) });
      expect(set).toHaveLength(QUESTIONS_PER_SET);
      const unitKanji = new Set(data.kanji.filter((k) => k.unitId === "g1-u1").map((k) => k.kanji));
      expect(set.every((i) => unitKanji.has(i.question.kanji))).toBe(true);
      expect(new Set(set.map((i) => i.question.kanji)).size).toBe(set.length);
      for (const f of ["single", "word", "sentence"]) {
        expect(set.filter((i) => i.question.format === f).length).toBeLessThanOrEqual(MAX_PER_FORMAT);
      }
    }
  });

  it("選択肢は正解 1 + 誤答 3 の 4 つ", () => {
    const set = buildQuestionSet({ mode: "practice", data, unitId: "g1-u2", progress: new Map(), reviewItems: [], rng: seededRng(3) });
    for (const { question, choices } of set) {
      expect([...choices].sort()).toEqual([question.answer, ...question.distractors].sort());
    }
  });

  it("未回答 → 学習中 → 習得済みの順に優先する", () => {
    const unit = data.kanji.filter((k) => k.unitId === "g1-u1");
    // 10 字分の読みを習得済みにし、残りは未回答
    const mastered = unit.slice(0, 10).flatMap((k) => k.readings.map((r) => prog(r.readingId, "mastered")));
    const set = buildQuestionSet({ mode: "practice", data, unitId: "g1-u1", progress: progressOf(mastered), reviewItems: [], rng: seededRng(7) });
    const masteredKanji = new Set(unit.slice(0, 10).map((k) => k.kanji));
    expect(set.filter((i) => masteredKanji.has(i.question.kanji))).toHaveLength(0);
  });

  it("ふくしゅうは復習対象のみ。少なければその数だけ出題する", () => {
    const ids = data.questions.slice(0, 3).map((q) => q.questionId);
    const reviewItems: ReviewItem[] = ids.map((questionId) => ({ profileId: P, questionId, grade: 1, addedAt: 1 }));
    const set = buildQuestionSet({ mode: "review", data, progress: new Map(), reviewItems, rng: seededRng(1) });
    expect(set.map((i) => i.question.questionId).sort()).toEqual([...ids].sort());
  });

  it("タイムアタックは学年全体から 10 問", () => {
    const set = buildQuestionSet({ mode: "time_attack", data, progress: new Map(), reviewItems: [], rng: seededRng(5) });
    expect(set).toHaveLength(QUESTIONS_PER_SET);
  });
});

describe("習得状況・復習(FR-007, FR-013, FR-014)", () => {
  it(`${MASTERY_STREAK} 回連続正解で習得済み、不正解で連続数リセット`, () => {
    let p: ReadingProgress | undefined;
    for (let i = 0; i < MASTERY_STREAK; i++) p = applyAnswerToProgress(p, { profileId: P, readingId: "山:やま", correct: true, answeredAt: i }, 1);
    expect(p!.status).toBe("mastered");
    p = applyAnswerToProgress(p, { profileId: P, readingId: "山:やま", correct: false, answeredAt: 99 }, 1);
    expect(p).toMatchObject({ status: "learning", correctStreak: 0, lastWrongAt: 99 });
  });

  it("不正解は復習対象に追加、ふくしゅうで正解したら除去", () => {
    const [q1, q2] = data.questions;
    const practice = computeSessionOutcome("practice", 1, [answer(q1.questionId, false), answer(q2.questionId, true)], new Map());
    expect(practice.reviewAdd.map((r) => r.questionId)).toEqual([q1.questionId]);
    expect(practice.reviewRemove).toEqual([]);
    const review = computeSessionOutcome("review", 1, [answer(q1.questionId, true)], progressOf(practice.progress));
    expect(review.reviewRemove).toEqual([q1.questionId]);
  });

  it("漢字は全読みが習得済みで習得済み", () => {
    const yama = data.kanji.find((k) => k.kanji === "山")!;
    expect(kanjiStatus(yama, new Map())).toBe("new");
    expect(kanjiStatus(yama, progressOf([prog("山:やま", "mastered")]))).toBe("learning");
    const all = progressOf(yama.readings.map((r) => prog(r.readingId, "mastered")));
    expect(kanjiStatus(yama, all)).toBe("mastered");
    expect(masterySummary(data.kanji, all)).toMatchObject({ total: 80, mastered: 1 });
  });
});

describe("タイムアタック(FR-011)", () => {
  it("回答時間の合計 + 不正解ペナルティ", () => {
    expect(timeAttackTime([{ elapsedMs: 1000, correct: true }, { elapsedMs: 1500, correct: false }])).toBe(2500 + TIME_ATTACK_PENALTY_MS);
  });
});

describe("メダル(FR-012)", () => {
  const day = (d: number) => new Date(2026, 9, d, 18).getTime();
  const session = (finishedAt: number, extra: Partial<SessionRecord> = {}): SessionRecord => ({
    profileId: P, mode: "practice", grade: 1, unitId: "g1-u1", startedAt: finishedAt - 1, finishedAt, total: 10, correctCount: 7, ...extra,
  });

  it("連続学習日数", () => {
    expect(streakDays([])).toBe(0);
    expect(streakDays([day(1), day(2), day(2), day(3)])).toBe(3);
    expect(streakDays([day(1), day(3)])).toBe(1);
  });

  it("初回完了・満点・連続日数・スピードスター", () => {
    const current = session(day(3), { correctCount: 10 });
    const sessions = [session(day(1)), session(day(2)), current];
    const earned = evaluateMedals({ sessions, current, progress: new Map(), data, owned: new Set(["first_step"]) });
    expect(earned).toEqual(expect.arrayContaining(["perfect", "streak_3"]));
    expect(earned).not.toContain("first_step");

    const ta = [1, 2, 3].map((d) => session(day(d), { mode: "time_attack", newBest: true }));
    expect(evaluateMedals({ sessions: ta, current: ta[2], progress: new Map(), data, owned: new Set() })).toContain("speed_star");
  });

  it("単元クリア・学年マスター", () => {
    const all = progressOf(data.kanji.flatMap((k) => k.readings.map((r) => prog(r.readingId, "mastered"))));
    const current = session(day(1));
    expect(evaluateMedals({ sessions: [current], current, progress: all, data, owned: new Set() })).toEqual(
      expect.arrayContaining(["unit_clear", "grade_master_1"]),
    );
  });
});
