// 問題データ原稿の読み込み(生成スクリプトと検証テストで共用)

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import type { GradeContent } from "../src/data/content";
import type { ValidationContext } from "../src/data/validate";

export const ROOT = join(import.meta.dirname, "..");
export const CONTENT_DIR = join(ROOT, "content");
export const LOCK_FILE = join(CONTENT_DIR, "question-ids.lock.json");
export const REMOVED_FILE = join(CONTENT_DIR, "removed-question-ids.yaml");

export function loadContents(): GradeContent[] {
  return readdirSync(CONTENT_DIR)
    .filter((f) => /^grade-\d\.yaml$/.test(f))
    .sort()
    .map((f) => parse(readFileSync(join(CONTENT_DIR, f), "utf8")) as GradeContent);
}

export function loadValidationContext(): ValidationContext {
  const raw = parse(readFileSync(join(CONTENT_DIR, "official-kanji.yaml"), "utf8")) as Record<string, string>;
  const officialKanji = Object.fromEntries(Object.entries(raw).map(([g, s]) => [Number(g), [...s.trim()]]));
  const publishedQuestionIds = existsSync(LOCK_FILE) ? (JSON.parse(readFileSync(LOCK_FILE, "utf8")) as string[]) : [];
  const removedQuestionIds = existsSync(REMOVED_FILE) ? ((parse(readFileSync(REMOVED_FILE, "utf8")) as string[] | null) ?? []) : [];
  return { officialKanji, publishedQuestionIds, removedQuestionIds };
}
