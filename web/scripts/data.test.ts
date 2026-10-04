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
      {
        kanji: "山",
        readings: [{ on: "さん" }, { kun: "やま" }],
        words: [
          { word: "{火|か}山", kana: "かざん", reading: "さん", distractors: ["かやま", "ひやま", "ひざん"] },
          { word: "山{道|みち}", kana: "やまみち", reading: "やま", distractors: ["さんみち", "やまどう", "さんどう"] },
        ],
      },
      {
        kanji: "川",
        readings: [{ kun: "かわ" }],
        words: [
          { word: "川{上|かみ}", kana: "かわかみ", reading: "かわ", distractors: ["せんかみ", "かわうえ", "せんじょう"] },
          { word: "{小|お}川", kana: "おがわ", reading: "かわ", distractors: ["こかわ", "しょうせん", "おせん"] },
        ],
      },
      {
        kanji: "九",
        readings: [{ on: "きゅう" }, { on: "く" }],
        words: [
          { word: "九{回|かい}", kana: "きゅうかい", reading: "きゅう", distractors: ["くかい", "ここのかい", "きゅかい"] },
          { word: "九{月|がつ}", kana: "くがつ", reading: "く", distractors: ["きゅうがつ", "くげつ", "ここのがつ"] },
        ],
      },
      {
        kanji: "森",
        readings: [{ on: "しん" }, { kun: "もり" }],
        words: [
          { word: "森{林|りん}", kana: "しんりん", reading: "しん", distractors: ["もりりん", "しんばやし", "もりばやし"] },
          { word: "{青|あお}森", kana: "あおもり", reading: "もり", distractors: ["あおしん", "せいしん", "せいもり"] },
        ],
        sentences: [{ text: "[森]に いく。", reading: "もり", distractors: ["しん", "はやし", "もの"] }],
      },
      // じつ・か は出題しないが 日 の正しい読み。人手チェック用に exclude に残す
      {
        kanji: "日",
        readings: [{ on: "にち" }, { kun: "ひ" }],
        exclude: ["じつ", "か"],
        words: [
          { word: "{毎|まい}日", kana: "まいにち", reading: "にち", distractors: ["まいひ", "まいじつ", "まいか"] },
          { word: "{朝|あさ}日", kana: "あさひ", reading: "ひ", distractors: ["あさにち", "ちょうひ", "あさび"] },
        ],
      },
    ],
  };
  const base = buildGrade(content).data;

  it("正しいデータはエラーなし", () => {
    expect(validateGrade(base, ctx)).toEqual([]);
  });
  it("単漢字問題は生成しない(熟語・文中のみ)", () => {
    expect(base.questions.map((q) => q.format)).not.toContain("single");
    expect(base.questions.filter((q) => q.kanji === "森").map((q) => q.format).sort()).toEqual(["sentence", "word", "word"]);
  });
  it("読みのない漢字を検出する", () => {
    const data = structuredClone(base);
    data.kanji.find((k) => k.kanji === "川")!.readings = [];
    data.questions = data.questions.filter((q) => q.kanji !== "川");
    expect(validateGrade(data, ctx).join()).toContain("読みのない漢字");
  });
  it("問題のない読みを検出する", () => {
    const data = structuredClone(base);
    data.questions = data.questions.filter((q) => q.readingId !== "山:やま");
    expect(validateGrade(data, ctx).join()).toContain("問題のない読み: 山:やま");
  });
  it("熟語問題が 2 問未満の漢字を検出する", () => {
    const data = structuredClone(base);
    const i = data.questions.findIndex((q) => q.kanji === "森" && q.format === "word");
    data.questions.splice(i, 1);
    expect(validateGrade(data, ctx).join()).toContain("熟語問題が 2 問未満の漢字: 森");
  });
  it("未習漢字にルビがないと検出する", () => {
    const data = structuredClone(base);
    data.questions.find((q) => q.format === "word")!.ruby = [];
    expect(validateGrade(data, ctx).join()).toContain("ルビがない");
  });
  it("選択肢の重複・ひらがな以外を検出する", () => {
    const data = structuredClone(base);
    const q = data.questions[0];
    q.distractors = [q.answer, "ヤマ", "やま"];
    const errors = validateGrade(data, ctx).join();
    expect(errors).toContain("選択肢が重複");
    expect(errors).toContain("ひらがな以外");
  });
  it("公開済みの問題 ID の削除を検出する", () => {
    expect(validateGrade(base, { ...ctx, publishedQuestionIds: ["山:さん:word:山林"] }).join()).toContain("消えている");
    expect(validateGrade(base, { ...ctx, publishedQuestionIds: ["山:さん:word:山林"], removedQuestionIds: ["山:さん:word:山林"] })).toEqual([]);
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
