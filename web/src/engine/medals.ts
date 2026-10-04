// FR-012: メダル(条件は仮置き。docs/design/04-functional-spec.mdx)

import { GRADES } from "../config";
import type { GradeData } from "../data/types";
import { masterySummary } from "./progress";
import type { ReadingProgress, SessionRecord } from "./types";

export interface MedalDef {
  id: string;
  name: string;
  description: string;
  emoji: string;
}

export const MEDALS: MedalDef[] = [
  { id: "first_step", name: "はじめの いっぽ", description: "はじめて セットを さいごまで といた", emoji: "👣" },
  { id: "perfect", name: "まんてん", description: "れんしゅうで ぜんもん せいかい", emoji: "💯" },
  { id: "streak_3", name: "れんぞく 3にち", description: "3にち つづけて れんしゅうした", emoji: "🔥" },
  { id: "streak_7", name: "れんぞく 7にち", description: "7にち つづけて れんしゅうした", emoji: "🌟" },
  { id: "streak_30", name: "れんぞく 30にち", description: "30にち つづけて れんしゅうした", emoji: "👑" },
  { id: "unit_clear", name: "たんげん クリア", description: "ステージの かんじを ぜんぶ おぼえた", emoji: "🚩" },
  ...GRADES.map((g) => ({
    id: `grade_master_${g}`,
    name: `${g}ねん マスター`,
    description: `${g}ねんの かんじを ぜんぶ おぼえた`,
    emoji: "🏆",
  })),
  { id: "speed_star", name: "スピード スター", description: "タイムアタックで じこベストを 3かい こうしん", emoji: "⚡" },
];

/** ローカル日付の通し日数 */
function dayNumber(ts: number): number {
  const d = new Date(ts);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

/** 最後にセットを完了した日から遡った連続学習日数 */
export function streakDays(finishedAts: readonly number[]): number {
  const days = [...new Set(finishedAts.map(dayNumber))].sort((a, b) => b - a);
  if (days.length === 0) return 0;
  let n = 1;
  while (n < days.length && days[n] === days[0] - n) n++;
  return n;
}

export interface MedalContext {
  /** 今回のセットを含む、完了済みセットすべて */
  sessions: readonly SessionRecord[];
  current: SessionRecord;
  /** 今回の結果を反映した後の習得状況 */
  progress: ReadonlyMap<string, ReadingProgress>;
  data: GradeData;
  owned: ReadonlySet<string>;
}

/** 新たに獲得したメダルの ID */
export function evaluateMedals(ctx: MedalContext): string[] {
  const { sessions, current, progress, data, owned } = ctx;
  const earned: string[] = [];
  const award = (id: string, cond: boolean) => {
    if (cond && !owned.has(id)) earned.push(id);
  };

  award("first_step", sessions.length >= 1);
  award("perfect", current.mode === "practice" && current.total > 0 && current.correctCount === current.total);
  const streak = streakDays(sessions.map((s) => s.finishedAt));
  award("streak_3", streak >= 3);
  award("streak_7", streak >= 7);
  award("streak_30", streak >= 30);

  const unitIds = [...new Set(data.kanji.map((k) => k.unitId))];
  award(
    "unit_clear",
    unitIds.some((u) => masterySummary(data.kanji.filter((k) => k.unitId === u), progress).rate === 1),
  );
  award(`grade_master_${data.grade}`, masterySummary(data.kanji, progress).rate === 1);
  award("speed_star", sessions.filter((s) => s.mode === "time_attack" && s.newBest).length >= 3);
  return earned;
}
