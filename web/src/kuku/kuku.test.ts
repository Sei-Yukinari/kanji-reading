import { describe, expect, it } from "vitest";
import { KUKU_MASTERY_STREAK, KUKU_QUESTIONS_PER_SET, KUKU_SLOW_MS } from "../config";
import { seededRng } from "../engine/random";
import { DANS, FACT_BY_ID, GORO, KUKU_FACTS, TRIANGLES, factsOfOneCell, factsOfTriangle } from "./data";
import {
  CHOICE_COUNT,
  buildKukuSet,
  cellStatus,
  computeKukuOutcome,
  dansKeyOf,
  isSlow,
  kukuTimeAttackTime,
  makeQuestion,
  randomQuestion,
  type KukuAnswer,
  type KukuProgress,
} from "./engine";
import { parseSpokenNumber, pickSpokenAnswer } from "./speech";

const P = "p1";
const fact = (id: string) => FACT_BY_ID.get(id)!;
const ans = (id: string, correct: boolean, slow = false, at = 1): KukuAnswer => ({
  profileId: P,
  question: makeQuestion(fact(id), "expr", "top"),
  given: correct ? fact(id).product : 0,
  correct,
  slow,
  method: "choice",
  elapsedMs: 1000,
  answeredAt: at,
});
const prog = (factId: string, fastStreak: number): KukuProgress => ({
  profileId: P, factId, fastStreak, status: fastStreak >= KUKU_MASTERY_STREAK ? "mastered" : "learning", lastAnsweredAt: 1,
});

describe("九九のデータ(FR-026, FR-029)", () => {
  it("81 式すべてに唱えと音声があり、音声ファイル名は重ならない", () => {
    expect(KUKU_FACTS).toHaveLength(81);
    for (const f of KUKU_FACTS) {
      expect(f.product).toBe(f.a * f.b);
      expect(f.chant[0]).toMatch(/^[ぁ-ん]+$/);
      expect(f.chant[1]).toMatch(/^[ぁ-ん]+$/);
    }
    expect(new Set(KUKU_FACTS.map((f) => f.audioId)).size).toBe(81);
  });

  it("積が 1 桁の唱えは「が」で終わり、2 桁は付かない(2 の段の 2×5 以降など)", () => {
    for (const f of KUKU_FACTS) expect(f.chant[0].endsWith("が")).toBe(f.product < 10);
  });

  it("三角視算表は 2〜9 の段の 36 組で、全体図と 1 の段の列で 81 式をちょうど覆う", () => {
    expect(TRIANGLES).toHaveLength(36);
    const covered = [...TRIANGLES.flatMap(factsOfTriangle), ...DANS.flatMap(factsOfOneCell)].map((f) => f.id);
    expect(covered).toHaveLength(81);
    expect(new Set(covered).size).toBe(81);
  });

  it("語呂合わせは実在する三角に付いていて、20 組ある", () => {
    const ids = new Set(TRIANGLES.map((t) => t.id));
    expect(Object.keys(GORO).every((k) => ids.has(k))).toBe(true);
    expect(Object.keys(GORO)).toHaveLength(20);
  });
});

describe("九九の出題セット(FR-027)", () => {
  it("じゅんばんは選んだ段の全式を暗唱の順に、式の形で出す", () => {
    const set = buildKukuSet({ config: { mode: "practice", dans: [3, 7], order: "sequential" }, progress: new Map(), reviewItems: [] });
    expect(set.map((q) => q.factId)).toEqual([...Array.from({ length: 9 }, (_, i) => `3x${i + 1}`), ...Array.from({ length: 9 }, (_, i) => `7x${i + 1}`)]);
    expect(set.every((q) => q.format === "expr" && q.hidden === "top")).toBe(true);
  });

  it("バラバラは選んだ段から最大 10 問、式の重複なし。三角は 2〜9 の段のみ", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const set = buildKukuSet({ config: { mode: "practice", dans: [1, 2], order: "random" }, progress: new Map(), reviewItems: [], rng: seededRng(seed) });
      expect(set).toHaveLength(KUKU_QUESTIONS_PER_SET);
      expect(new Set(set.map((q) => q.factId)).size).toBe(set.length);
      for (const q of set) {
        const f = fact(q.factId);
        expect([1, 2]).toContain(f.a);
        if (q.format === "triangle") expect(f.triangleId).not.toBeNull();
      }
    }
  });

  it("1 つの段だけのバラバラは 9 問", () => {
    const set = buildKukuSet({ config: { mode: "practice", dans: [6], order: "random" }, progress: new Map(), reviewItems: [], rng: seededRng(1) });
    expect(set).toHaveLength(9);
  });

  it("れんしゅうのバラバラは、まだ習得していない式を優先する", () => {
    const progress = new Map(KUKU_FACTS.filter((f) => f.a === 2 && f.b <= 5).map((f) => [f.id, prog(f.id, 3)]));
    for (let seed = 1; seed <= 10; seed++) {
      const set = buildKukuSet({ config: { mode: "practice", dans: [2, 3], order: "random" }, progress, reviewItems: [], rng: seededRng(seed) });
      expect(set.some((q) => progress.has(q.factId))).toBe(false);
    }
  });

  it("ふくしゅうは復習対象の式だけを出す", () => {
    const reviewItems = ["7x8", "6x7"].map((factId) => ({ profileId: P, factId, reason: "wrong" as const, addedAt: 1 }));
    const set = buildKukuSet({ config: { mode: "review", dans: [], order: "random" }, progress: new Map(), reviewItems, rng: seededRng(3) });
    expect(set.map((q) => q.factId).sort()).toEqual(["6x7", "7x8"]);
  });

  it("3 形式の答え: 式は積、積から因数・三角は隠した数", () => {
    const f = fact("3x4");
    expect(makeQuestion(f, "expr", "top").answer).toBe(12);
    expect(makeQuestion(f, "expr", "left").answer).toBe(3);
    expect(makeQuestion(f, "triangle", "right").answer).toBe(4);
    expect(() => makeQuestion(fact("1x4"), "triangle", "top")).toThrow();
  });

  it("4 択: すべての式・隠し方で、正解 1 つ + 重ならない誤答 3 つ。誤答は 1 以上(FR-030)", () => {
    const rng = seededRng(11);
    for (const f of KUKU_FACTS) {
      for (const hidden of ["top", "left", "right"] as const) {
        for (let k = 0; k < 5; k++) {
          const q = makeQuestion(f, "expr", hidden, rng);
          expect(q.choices).toHaveLength(CHOICE_COUNT);
          expect(new Set(q.choices).size).toBe(CHOICE_COUNT);
          expect(q.choices.filter((c) => c === q.answer)).toHaveLength(1);
          expect(q.choices.every((c) => Number.isInteger(c) && c >= 1)).toBe(true);
          // かける数を答える問題の誤答は 1〜9
          if (hidden !== "top") expect(q.choices.every((c) => c <= 9)).toBe(true);
        }
      }
    }
  });

  it("積を答える問題の誤答は、九九表で隣り合う積を優先する(7×8 → 48・49・63・64)", () => {
    const q = makeQuestion(fact("7x8"), "expr", "top", seededRng(1));
    const neighbors = new Set([48, 49, 63, 64]);
    expect(q.choices.filter((c) => c !== 56).every((c) => neighbors.has(c))).toBe(true);
  });

  it("正解の位置は 4 つの選択肢に散らばる", () => {
    const rng = seededRng(5);
    const positions = new Set(Array.from({ length: 50 }, () => {
      const q = makeQuestion(fact("6x7"), "expr", "top", rng);
      return q.choices.indexOf(q.answer);
    }));
    expect(positions).toEqual(new Set([0, 1, 2, 3]));
  });

  it("バラバラでは 3 形式がすべて出る", () => {
    const rng = seededRng(7);
    const kinds = new Set(Array.from({ length: 200 }, () => {
      const q = randomQuestion(fact("6x7"), rng);
      return q.format === "triangle" ? "triangle" : q.hidden === "top" ? "expr" : "factor";
    }));
    expect(kinds).toEqual(new Set(["expr", "triangle", "factor"]));
  });

  it("自己ベストのキーは段の組み合わせ。ぜんぶは 1-9", () => {
    expect(dansKeyOf([4, 3, 3])).toBe("3,4");
    expect(dansKeyOf([...DANS])).toBe("1-9");
  });
});

describe("九九の復習と習得(FR-033)", () => {
  it("遅い正解の基準は回答方法ごと", () => {
    expect(isSlow(KUKU_SLOW_MS.choice, "choice")).toBe(false);
    expect(isSlow(KUKU_SLOW_MS.choice + 1, "choice")).toBe(true);
    expect(isSlow(KUKU_SLOW_MS.choice + 1, "voice")).toBe(false);
  });

  it("誤答と遅い正解は復習の対象。理由を残す", () => {
    const out = computeKukuOutcome("practice", [ans("7x8", false), ans("6x7", true, true), ans("2x3", true)], new Map());
    expect(out.reviewAdd.map((r) => [r.factId, r.reason])).toEqual([["7x8", "wrong"], ["6x7", "slow"]]);
    expect(out.reviewRemove).toEqual([]);
  });

  it("速い正解を 3 回続けたら習得。遅い正解で連続が途切れる", () => {
    let progress = new Map<string, KukuProgress>();
    const apply = (a: KukuAnswer) => {
      for (const p of computeKukuOutcome("practice", [a], progress).progress) progress = new Map(progress).set(p.factId, p);
      return progress.get("7x8")!;
    };
    apply(ans("7x8", true));
    apply(ans("7x8", true));
    expect(apply(ans("7x8", true, true)).fastStreak).toBe(0);
    apply(ans("7x8", true));
    apply(ans("7x8", true));
    expect(apply(ans("7x8", true)).status).toBe("mastered");
  });

  it("ふくしゅうで速く正解したら外す。同じセットで間違えた式は外さない", () => {
    const out = computeKukuOutcome("review", [ans("7x8", true), ans("6x7", false), ans("6x7", true)], new Map());
    expect(out.reviewRemove).toEqual(["7x8"]);
    expect(out.reviewAdd.map((r) => r.factId)).toEqual(["6x7"]);
  });

  it("全体図のマスの状態: 要復習 > 習得 > 学習中 > 未学習。三角は入れ替えた式もまとめる", () => {
    const t = TRIANGLES.find((x) => x.id === "3-4")!;
    const facts = factsOfTriangle(t);
    expect(facts.map((f) => f.id)).toEqual(["3x4", "4x3"]);
    expect(cellStatus(facts, new Map(), new Set())).toBe("new");
    expect(cellStatus(facts, new Map([["3x4", prog("3x4", 3)]]), new Set())).toBe("learning");
    const both = new Map([["3x4", prog("3x4", 3)], ["4x3", prog("4x3", 4)]]);
    expect(cellStatus(facts, both, new Set())).toBe("mastered");
    expect(cellStatus(facts, both, new Set(["4x3"]))).toBe("review");
  });

  it("タイムアタックは不正解 1 問につき 5 秒加算", () => {
    expect(kukuTimeAttackTime([ans("2x2", true), ans("2x3", false)])).toBe(2000 + 5000);
  });
});

describe("音声入力の数の読み取り(FR-031)", () => {
  it.each([
    ["12", 12], ["１２", 12], ["十二", 12], ["八十一", 81], ["二十", 20], ["九", 9],
    ["じゅうに", 12], ["にじゅうし", 24], ["しじゅうく", 49], ["ろくじゅうさん", 63], ["きゅう", 9], ["く", 9],
    ["ジュウロク", 16], ["さんじゅうろく", 36], ["しち", 7], ["なな", 7], ["12です", 12], ["34 12", 12],
  ])("%s → %d", (text, n) => {
    expect(parseSpokenNumber(text)).toBe(n);
  });

  it.each(["", "わからない", "じゅうじゅう", "にさん"])("読み取れない: %s", (text) => {
    expect(parseSpokenNumber(text)).toBeNull();
  });

  it("候補のどれかが正解なら正解。なければ最初に読み取れた数", () => {
    expect(pickSpokenAnswer(["蜂", "8"], 8)).toBe(8);
    expect(pickSpokenAnswer(["十三", "十二"], 12)).toBe(12);
    expect(pickSpokenAnswer(["十三", "十四"], 12)).toBe(13);
    expect(pickSpokenAnswer(["こんにちは"], 12)).toBeNull();
  });
});
