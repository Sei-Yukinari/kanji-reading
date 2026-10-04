// 仮置きの設計パラメータ(docs/design/04-functional-spec.mdx「仮置きした設計パラメータ」)。
// 顧客と確定したらここだけを変更する。

/** 1 セットの問題数(FR-002) */
export const QUESTIONS_PER_SET = 10;

/** 1 形式あたりの 1 セット内の上限問題数(FR-002) */
export const MAX_PER_FORMAT = 6;

/** 単元の目安の漢字数(FR-015) */
export const UNIT_SIZE = 20;

/** 習得済みとみなす連続正解数(FR-014) */
export const MASTERY_STREAK = 3;

/** 正誤表示から自動遷移までの時間(ミリ秒)(FR-007) */
export const FEEDBACK_MS = {
  practice: { correct: 1000, wrong: 2000 },
  time_attack: { correct: 500, wrong: 1000 },
} as const;

/** タイムアタックの不正解ペナルティ(ミリ秒)(FR-011) */
export const TIME_ATTACK_PENALTY_MS = 5000;

/** タイムアタック開始前のカウントダウン秒数(FR-011) */
export const COUNTDOWN_SECONDS = 3;

/** プロフィール上限(FR-016) */
export const MAX_PROFILES = 4;

/** ニックネームの文字数(FR-016) */
export const NICKNAME_MAX = 10;

/** プロフィールあたりの ANSWER 保存上限(ER図 備考) */
export const MAX_ANSWERS_PER_PROFILE = 5000;

/** 対応する問題データ形式のバージョン(API-001) */
export const SUPPORTED_SCHEMA_VERSION = 1;

/** 学年 */
export const GRADES = [1, 2, 3, 4, 5, 6] as const;
export type Grade = (typeof GRADES)[number];
