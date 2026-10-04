// 問題データ原稿の検証(ビルド前に npm test で自動実行される)
import { describe, expect, it } from "vitest";
import { buildGrade, parseMarkup, parseReadingNotation, type GradeContent } from "../src/data/content";
import { validateGrade } from "../src/data/validate";
import { loadContents, loadValidationContext } from "./data-io";

describe("原稿の記法", () => {
  it("送り仮名付きの読みを分解できる", () => {
    expect(parseReadingNotation("のぼ(る)")).toEqual({ kana: "のぼ", okurigana: "る" });
    expect(parseReadingNotation("やま")).toEqual({ kana: "やま" });
  });
  it("ルビと出題範囲を取り出せる", () => {
    expect(parseMarkup("{遠|えん}[足]に いく")).toEqual({
      prompt: "遠足に いく",
      ruby: [{ start: 0, length: 1, kana: "えん" }],
      highlight: { start: 1, length: 1 },
    });
  });
});

describe("検証ルール", () => {
  const ctx = { officialKanji: { 1: ["山", "川", "九", "森", "日"] } };
  const content: GradeContent = {
    grade: 1,
    kanji: [
      { kanji: "山", readings: [{ on: "さん" }, { kun: "やま" }], words: [{ word: "{火|か}山", kana: "かざん", reading: "さん", distractors: ["かやま", "ひやま", "ひざん"] }] },
      { kanji: "川", readings: [{ kun: "かわ" }] },
      { kanji: "九", readings: [{ on: "きゅう" }, { on: "く" }] },
      { kanji: "森", readings: [{ on: "しん" }, { kun: "もり" }] },
      // じつ・か は出題しないが 日 の正しい読みなので、他の漢字の単漢字問題の誤答には使えても、日 の誤答には使わない
      { kanji: "日", readings: [{ on: "にち" }, { kun: "ひ" }], exclude: ["じつ", "か"] },
    ],
  };
  const base = buildGrade(content).data;

  it("正しいデータはエラーなし", () => {
    expect(validateGrade(base, ctx)).toEqual([]);
  });
  it("出題しない読み(exclude)は単漢字問題の誤答に使わず、検証でも検出する", () => {
    // 九:く の問題の誤答候補に 日 の読みは含まれても、日 の問題の誤答に か は出ない
    for (const q of base.questions.filter((q) => q.kanji === "日" && q.format === "single")) expect(q.distractors).not.toContain("か");
    const data = structuredClone(base);
    const q = data.questions.find((q) => q.kanji === "日" && q.format === "single")!;
    q.distractors = ["か", "め", "て"];
    expect(validateGrade(data, ctx).join()).toContain("対象漢字の読みが含まれる");
  });
  it("読みのない漢字を検出する", () => {
    const data = structuredClone(base);
    data.kanji.find((k) => k.kanji === "川")!.readings = [];
    data.questions = data.questions.filter((q) => q.kanji !== "川");
    expect(validateGrade(data, ctx).join()).toContain("読みのない漢字");
  });
  it("未習漢字にルビがないと検出する", () => {
    const data = structuredClone(base);
    data.questions.find((q) => q.format === "word")!.ruby = [];
    expect(validateGrade(data, ctx).join()).toContain("ルビがない");
  });
  it("選択肢の重複・ひらがな以外・正解の混入を検出する", () => {
    const data = structuredClone(base);
    const q = data.questions[0];
    q.distractors = [q.answer, "ヤマ", "やま"];
    const errors = validateGrade(data, ctx).join();
    expect(errors).toContain("選択肢が重複");
    expect(errors).toContain("ひらがな以外");
    expect(errors).toContain("対象漢字の読みが含まれる");
  });
  it("公開済みの問題 ID の削除を検出する", () => {
    expect(validateGrade(base, { ...ctx, publishedQuestionIds: ["山:ざん:single"] }).join()).toContain("消えている");
    expect(validateGrade(base, { ...ctx, publishedQuestionIds: ["山:ざん:single"], removedQuestionIds: ["山:ざん:single"] })).toEqual([]);
  });
});

describe("収録データ", () => {
  const ctx = loadValidationContext();
  for (const content of loadContents()) {
    it(`${content.grade}年の問題データが検証を通る`, () => {
      expect(validateGrade(buildGrade(content).data, ctx)).toEqual([]);
    });
  }
});
