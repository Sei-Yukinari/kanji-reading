// 問題データ原稿の検証(ビルド前に npm test で自動実行される)
import { describe, expect, it } from "vitest";
import { buildGrade, parseMarkup, parseReadingNotation } from "../src/data/content";
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
  const base = buildGrade({
    grade: 1,
    kanji: [
      { kanji: "山", readings: [{ on: "さん" }, { kun: "やま" }], words: [{ word: "{火|か}山", kana: "かざん", reading: "さん", distractors: ["かやま", "ひやま", "ひざん"] }] },
      { kanji: "川", readings: [{ kun: "かわ" }] },
      { kanji: "九", readings: [{ on: "きゅう" }, { on: "く" }] },
      { kanji: "森", readings: [{ on: "しん" }, { kun: "もり" }] },
      { kanji: "日", readings: [{ on: "にち" }, { kun: "ひ" }] },
    ],
  }).data;

  it("正しいデータはエラーなし", () => {
    expect(validateGrade(base, ctx)).toEqual([]);
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
