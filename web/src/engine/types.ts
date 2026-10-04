// 学習データの型(docs/design/07-er-diagram.mdx 学習データ)。出題エンジンとストアで共用する。

import type { Question } from "../data/types";

export type Mode = "practice" | "time_attack" | "review";

export interface Profile {
  id: string;
  nickname: string;
  icon: string;
  createdAt: number;
  /** 前回選んだ学年(FR-001) */
  lastGrade: number;
}

export interface Settings {
  profileId: string;
  sound: boolean;
  voice: boolean;
}

export interface SessionRecord {
  id?: number;
  profileId: string;
  mode: Mode;
  grade: number;
  unitId?: string;
  startedAt: number;
  finishedAt: number;
  total: number;
  correctCount: number;
  /** タイムアタックのタイム(ペナルティ込み) */
  timeMs?: number;
  /** タイムアタックで自己ベストを更新したか */
  newBest?: boolean;
}

export interface AnswerRecord {
  id?: number;
  sessionId?: number;
  profileId: string;
  questionId: string;
  readingId: string;
  kanji: string;
  chosen: string;
  correct: boolean;
  /** 問題表示から回答までの時間 */
  elapsedMs: number;
  answeredAt: number;
}

export type ReadingStatus = "learning" | "mastered";

export interface ReadingProgress {
  profileId: string;
  readingId: string;
  grade: number;
  correctStreak: number;
  status: ReadingStatus;
  lastAnsweredAt: number;
  lastWrongAt?: number;
}

export interface ReviewItem {
  profileId: string;
  questionId: string;
  grade: number;
  addedAt: number;
}

export interface BestRecord {
  profileId: string;
  grade: number;
  timeMs: number;
  achievedAt: number;
}

export interface MedalAward {
  profileId: string;
  medalId: string;
  awardedAt: number;
}

/** 出題する 1 問(選択肢はシャッフル済み) */
export interface QuizItem {
  question: Question;
  choices: string[];
}

export type KanjiStatus = "new" | "learning" | "mastered";
