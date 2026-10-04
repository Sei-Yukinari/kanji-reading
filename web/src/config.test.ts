import { describe, expect, it } from "vitest";
import { FEEDBACK_MS, QUESTIONS_PER_SET, MAX_PER_FORMAT } from "./config";

describe("config", () => {
  it("1 形式の上限は 1 セットの問題数を超えない", () => {
    expect(MAX_PER_FORMAT).toBeLessThanOrEqual(QUESTIONS_PER_SET);
  });
  it("不正解の表示時間は正解以上", () => {
    expect(FEEDBACK_MS.practice.wrong).toBeGreaterThanOrEqual(FEEDBACK_MS.practice.correct);
  });
});
