import Dexie from "dexie";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_ANSWERS_PER_PROFILE } from "../config";
import type { AnswerRecord, Profile, SessionRecord } from "../engine/types";
import { classifyOpenError, LearningDB, LearningStore } from "./db";

let store: LearningStore;
let n = 0;

beforeEach(async () => {
  const db = new LearningDB(`test-${n++}`, { indexedDB, IDBKeyRange });
  await db.open();
  store = new LearningStore(db, true);
});

const profile = (id: string, createdAt = 1): Profile => ({ id, nickname: id, icon: "🐶", createdAt, lastGrade: 1 });
const session = (profileId: string): SessionRecord => ({
  profileId, mode: "practice", grade: 1, unitId: "g1-u1", startedAt: 1, finishedAt: 2, total: 1, correctCount: 0,
});
const answer = (profileId: string, answeredAt: number): AnswerRecord => ({
  profileId, questionId: "山:やま:sentence:1", readingId: "山:やま", kanji: "山", chosen: "かわ", correct: false, elapsedMs: 1, answeredAt,
});

describe("LearningStore", () => {
  it("プロフィール作成時に既定の設定を作る", async () => {
    await store.saveProfile(profile("a"));
    expect(await store.getSettings("a")).toEqual({ profileId: "a", sound: true, voice: true });
    expect((await store.listProfiles()).map((p) => p.id)).toEqual(["a"]);
  });

  it("セット結果を一括保存し、プロフィール削除で関連データも消える", async () => {
    await store.saveProfile(profile("a"));
    await store.saveProfile(profile("b", 2));
    for (const id of ["a", "b"]) {
      await store.saveSessionResult({
        session: session(id),
        answers: [answer(id, 1)],
        outcome: {
          progress: [{ profileId: id, readingId: "山:やま", grade: 1, correctStreak: 0, status: "learning", lastAnsweredAt: 1, lastWrongAt: 1 }],
          reviewAdd: [{ profileId: id, questionId: "山:やま:sentence:1", grade: 1, addedAt: 1 }],
          reviewRemove: [],
        },
        best: { profileId: id, grade: 1, timeMs: 1000, achievedAt: 2 },
        medals: [{ profileId: id, medalId: "first_step", awardedAt: 2 }],
      });
    }
    expect((await store.getProgress("a", 1)).get("山:やま")?.status).toBe("learning");
    expect(await store.getReviewItems("a", 1)).toHaveLength(1);
    expect((await store.getBest("a", 1))?.timeMs).toBe(1000);

    await store.deleteProfile("a");
    expect(await store.getProfile("a")).toBeUndefined();
    expect(await store.getSessions("a")).toEqual([]);
    expect(await store.getMedals("a")).toEqual([]);
    expect((await store.getProgress("a")).size).toBe(0);
    // 他のプロフィールは残る
    expect(await store.getSessions("b")).toHaveLength(1);
    expect(await store.getReviewItems("b")).toHaveLength(1);
  });

  it("ふくしゅうで正解した問題を復習対象から除去する", async () => {
    await store.saveProfile(profile("a"));
    await store.db.reviewItems.put({ profileId: "a", questionId: "q1", grade: 1, addedAt: 1 });
    await store.saveSessionResult({
      session: { ...session("a"), mode: "review" },
      answers: [],
      outcome: { progress: [], reviewAdd: [], reviewRemove: ["q1"] },
      medals: [],
    });
    expect(await store.getReviewItems("a")).toEqual([]);
  });

  it(`ANSWER は直近 ${MAX_ANSWERS_PER_PROFILE} 件まで保持する`, async () => {
    await store.saveProfile(profile("a"));
    await store.db.answers.bulkAdd(Array.from({ length: MAX_ANSWERS_PER_PROFILE }, (_, i) => answer("a", i + 10)));
    await store.saveSessionResult({
      session: session("a"),
      answers: [answer("a", 999_999), answer("a", 1_000_000)],
      outcome: { progress: [], reviewAdd: [], reviewRemove: [] },
      medals: [],
    });
    const rows = await store.db.answers.where("profileId").equals("a").sortBy("answeredAt");
    expect(rows).toHaveLength(MAX_ANSWERS_PER_PROFILE);
    expect(rows[0].answeredAt).toBe(12);
  });

  it("削除された問題の復習対象を除去する", async () => {
    await store.db.reviewItems.bulkPut([
      { profileId: "a", questionId: "old", grade: 1, addedAt: 1 },
      { profileId: "a", questionId: "keep", grade: 1, addedAt: 1 },
    ]);
    await store.purgeRemovedQuestions(["old"]);
    expect((await store.getReviewItems("a")).map((r) => r.questionId)).toEqual(["keep"]);
  });
});

describe("九九の学習データ(FR-033)", () => {
  const outcome = (profileId: string) => ({
    progress: [{ profileId, factId: "7x8", fastStreak: 0, status: "learning" as const, lastAnsweredAt: 1 }],
    reviewAdd: [{ profileId, factId: "7x8", reason: "wrong" as const, addedAt: 1 }],
    reviewRemove: [],
  });

  it("習得状況・復習対象・自己ベストを保存し、ふくしゅうで正解した式を外す", async () => {
    await store.saveProfile(profile("a"));
    await store.saveKukuResult("a", outcome("a"), { profileId: "a", dansKey: "7", timeMs: 9000, achievedAt: 2 });
    expect((await store.getKukuProgress("a")).get("7x8")?.status).toBe("learning");
    expect((await store.getKukuReview("a")).map((r) => r.reason)).toEqual(["wrong"]);
    expect((await store.getKukuBest("a", "7"))?.timeMs).toBe(9000);

    await store.saveKukuResult("a", { progress: [], reviewAdd: [], reviewRemove: ["7x8"] });
    expect(await store.getKukuReview("a")).toEqual([]);
  });

  it("プロフィール削除で九九の記録も消え、他のプロフィールは残る", async () => {
    await store.saveProfile(profile("a"));
    await store.saveProfile(profile("b", 2));
    await store.saveKukuResult("a", outcome("a"), { profileId: "a", dansKey: "1-9", timeMs: 1, achievedAt: 1 });
    await store.saveKukuResult("b", outcome("b"));
    await store.deleteProfile("a");
    expect((await store.getKukuProgress("a")).size).toBe(0);
    expect(await store.getKukuReview("a")).toEqual([]);
    expect(await store.getKukuBest("a", "1-9")).toBeUndefined();
    expect(await store.getKukuReview("b")).toHaveLength(1);
  });

  it("version 1 の学習データを残したまま、九九のテーブルを追加できる", async () => {
    const name = `migrate-${n++}`;
    const v1 = new Dexie(name, { indexedDB, IDBKeyRange });
    v1.version(1).stores({ profiles: "id", settings: "profileId", readingProgress: "[profileId+readingId], profileId" });
    await v1.open();
    await v1.table("profiles").put(profile("old"));
    v1.close();

    const db = new LearningDB(name, { indexedDB, IDBKeyRange });
    await db.open();
    const migrated = new LearningStore(db, true);
    expect((await migrated.getProfile("old"))?.nickname).toBe("old");
    await migrated.saveKukuResult("old", outcome("old"));
    expect(await migrated.getKukuReview("old")).toHaveLength(1);
  });
});

describe("openStore のフォールバック理由", () => {
  it("スキーマ移行系のエラーは broken、それ以外は unavailable", () => {
    expect(classifyOpenError(Object.assign(new Error("x"), { name: "VersionError" }))).toBe("broken");
    // Dexie は open 失敗を OpenFailedError に包み、元のエラーを inner に持つ
    expect(classifyOpenError({ name: "OpenFailedError", inner: { name: "UpgradeError" } })).toBe("broken");
    expect(classifyOpenError({ name: "OpenFailedError", inner: { name: "SecurityError" } })).toBe("unavailable");
    expect(classifyOpenError(new Error("IndexedDB unavailable"))).toBe("unavailable");
    expect(classifyOpenError(undefined)).toBe("unavailable");
  });
});
