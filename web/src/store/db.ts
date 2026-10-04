// 学習データストア(T-003: IndexedDB + Dexie.js)。学習データは端末外へ送信しない(NFR-010)。

import Dexie, { type DexieOptions, type Table } from "dexie";
import { MAX_ANSWERS_PER_PROFILE } from "../config";
import type { SessionOutcome } from "../engine/progress";
import type {
  AnswerRecord,
  BestRecord,
  MedalAward,
  Profile,
  ReadingProgress,
  ReviewItem,
  SessionRecord,
  Settings,
} from "../engine/types";

export interface MetaEntry {
  key: string;
  value: unknown;
}

export class LearningDB extends Dexie {
  profiles!: Table<Profile, string>;
  settings!: Table<Settings, string>;
  sessions!: Table<SessionRecord, number>;
  answers!: Table<AnswerRecord, number>;
  readingProgress!: Table<ReadingProgress, [string, string]>;
  reviewItems!: Table<ReviewItem, [string, string]>;
  bestRecords!: Table<BestRecord, [string, number]>;
  medalAwards!: Table<MedalAward, [string, string]>;
  meta!: Table<MetaEntry, string>;

  constructor(name = "kanji-reading", options?: DexieOptions) {
    super(name, options);
    // スキーマ変更時は version を上げ、upgrade でマイグレーションする(ER図 備考)
    this.version(1).stores({
      profiles: "id",
      settings: "profileId",
      sessions: "++id, profileId",
      answers: "++id, profileId, [profileId+answeredAt]",
      readingProgress: "[profileId+readingId], profileId",
      reviewItems: "[profileId+questionId], profileId",
      bestRecords: "[profileId+grade], profileId",
      medalAwards: "[profileId+medalId], profileId",
      meta: "key",
    });
  }
}

export interface SessionResultToSave {
  session: SessionRecord;
  answers: AnswerRecord[];
  outcome: SessionOutcome;
  best?: BestRecord;
  medals: MedalAward[];
}

/**
 * 端末の IndexedDB を開けなかった理由(docs/design/04-functional-spec.mdx エラーハンドリング)
 * - unavailable: IndexedDB が使えない(プライベートブラウズ等)
 * - broken: 学習データのスキーマ移行に失敗した(新しいバージョンの DB が残っている等)。旧データは消さずに保持する
 */
export type StoreFallbackReason = "unavailable" | "broken";

/** 学習データの読み書き。IndexedDB が使えない場合はメモリ上で動作し、記録は残らない */
export class LearningStore {
  constructor(
    readonly db: LearningDB,
    /** false のとき記録は端末に保存されない(プライベートブラウズ等) */
    readonly persistent: boolean,
    /** persistent が false のときの理由 */
    readonly fallbackReason?: StoreFallbackReason,
  ) {}

  // --- プロフィール・設定(FR-016, FR-010) ---

  async listProfiles(): Promise<Profile[]> {
    return (await this.db.profiles.toArray()).sort((a, b) => a.createdAt - b.createdAt);
  }

  getProfile(id: string): Promise<Profile | undefined> {
    return this.db.profiles.get(id);
  }

  async saveProfile(profile: Profile): Promise<void> {
    await this.db.transaction("rw", this.db.profiles, this.db.settings, async () => {
      await this.db.profiles.put(profile);
      if (!(await this.db.settings.get(profile.id))) {
        await this.db.settings.put({ profileId: profile.id, sound: true, voice: true });
      }
    });
  }

  async deleteProfile(profileId: string): Promise<void> {
    const db = this.db;
    await db.transaction(
      "rw",
      [db.profiles, db.settings, db.sessions, db.answers, db.readingProgress, db.reviewItems, db.bestRecords, db.medalAwards, db.meta],
      async () => {
        await db.profiles.delete(profileId);
        await db.settings.delete(profileId);
        for (const t of [db.sessions, db.answers, db.readingProgress, db.reviewItems, db.bestRecords, db.medalAwards] as Table<{ profileId: string }, unknown>[]) {
          await t.where("profileId").equals(profileId).delete();
        }
        if ((await this.getMeta<string>("lastProfileId")) === profileId) await db.meta.delete("lastProfileId");
      },
    );
  }

  async getSettings(profileId: string): Promise<Settings> {
    return (await this.db.settings.get(profileId)) ?? { profileId, sound: true, voice: true };
  }

  async saveSettings(settings: Settings): Promise<void> {
    await this.db.settings.put(settings);
  }

  // --- 学習データの参照 ---

  async getProgress(profileId: string, grade?: number): Promise<Map<string, ReadingProgress>> {
    const rows = await this.db.readingProgress.where("profileId").equals(profileId).toArray();
    return new Map(rows.filter((r) => grade === undefined || r.grade === grade).map((r) => [r.readingId, r]));
  }

  async getReviewItems(profileId: string, grade?: number): Promise<ReviewItem[]> {
    const rows = await this.db.reviewItems.where("profileId").equals(profileId).toArray();
    return rows.filter((r) => grade === undefined || r.grade === grade);
  }

  getBest(profileId: string, grade: number): Promise<BestRecord | undefined> {
    return this.db.bestRecords.get([profileId, grade]);
  }

  getSessions(profileId: string): Promise<SessionRecord[]> {
    return this.db.sessions.where("profileId").equals(profileId).sortBy("finishedAt");
  }

  getMedals(profileId: string): Promise<MedalAward[]> {
    return this.db.medalAwards.where("profileId").equals(profileId).toArray();
  }

  // --- セット完了時の保存(FR-017: 1 トランザクション) ---

  async saveSessionResult(r: SessionResultToSave): Promise<number> {
    const db = this.db;
    return db.transaction(
      "rw",
      [db.sessions, db.answers, db.readingProgress, db.reviewItems, db.bestRecords, db.medalAwards],
      async () => {
        const sessionId = await db.sessions.add(r.session);
        await db.answers.bulkAdd(r.answers.map((a) => ({ ...a, sessionId })));
        await db.readingProgress.bulkPut(r.outcome.progress);
        await db.reviewItems.bulkPut(r.outcome.reviewAdd);
        await db.reviewItems.bulkDelete(r.outcome.reviewRemove.map((q) => [r.session.profileId, q] as [string, string]));
        if (r.best) await db.bestRecords.put(r.best);
        if (r.medals.length) await db.medalAwards.bulkPut(r.medals);
        await this.trimAnswers(r.session.profileId);
        return sessionId;
      },
    );
  }

  /** ANSWER はプロフィールあたり直近の上限件数まで保持する */
  private async trimAnswers(profileId: string): Promise<void> {
    const count = await this.db.answers.where("profileId").equals(profileId).count();
    const excess = count - MAX_ANSWERS_PER_PROFILE;
    if (excess <= 0) return;
    const old = await this.db.answers
      .where("[profileId+answeredAt]")
      .between([profileId, Dexie.minKey], [profileId, Dexie.maxKey])
      .limit(excess)
      .primaryKeys();
    await this.db.answers.bulkDelete(old);
  }

  /** 問題データから削除された問題への参照を除去する(ER図 備考) */
  async purgeRemovedQuestions(removedQuestionIds: readonly string[]): Promise<void> {
    if (removedQuestionIds.length === 0) return;
    const removed = new Set(removedQuestionIds);
    await this.db.reviewItems.filter((r) => removed.has(r.questionId)).delete();
  }

  // --- 端末内のアプリ状態 ---

  async getMeta<T>(key: string): Promise<T | undefined> {
    return (await this.db.meta.get(key))?.value as T | undefined;
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    await this.db.meta.put({ key, value });
  }
}

/**
 * ストアを開く。IndexedDB が使えない環境では、メモリ上の IndexedDB 実装で開き直し、
 * 学習は続けられるが記録は保存しない(docs/design/04-functional-spec.mdx エラーハンドリング)。
 */
export async function openStore(): Promise<LearningStore> {
  let reason: StoreFallbackReason;
  try {
    if (typeof indexedDB === "undefined") throw new Error("IndexedDB unavailable");
    const db = new LearningDB();
    await db.open();
    void requestPersistence();
    return new LearningStore(db, true);
  } catch (e) {
    reason = classifyOpenError(e);
    console.warn(
      reason === "broken" ? "学習データを開けないため(スキーマ不一致)、旧データを保持したまま記録を保存しないモードで起動します" : "IndexedDB を使えないため、記録を保存しないモードで起動します",
      e,
    );
  }
  const { indexedDB: memIDB, IDBKeyRange: memRange } = await import("fake-indexeddb");
  const db = new LearningDB("kanji-reading-memory", { indexedDB: memIDB, IDBKeyRange: memRange });
  await db.open();
  return new LearningStore(db, false, reason);
}

/** Dexie の open 失敗を分類する。スキーマ移行系のエラーは `inner` に包まれていることがあるので辿る */
export function classifyOpenError(e: unknown): StoreFallbackReason {
  const MIGRATION_ERRORS = new Set(["VersionError", "UpgradeError", "SchemaError"]);
  for (let cur = e as { name?: unknown; inner?: unknown } | null, depth = 0; cur && typeof cur === "object" && depth < 5; cur = cur.inner as typeof cur, depth++) {
    if (typeof cur.name === "string" && MIGRATION_ERRORS.has(cur.name)) return "broken";
  }
  return "unavailable";
}

/** ブラウザによる自動削除を避けるため、ストレージの永続化を要求する(NFR-014)。拒否されても続行 */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
