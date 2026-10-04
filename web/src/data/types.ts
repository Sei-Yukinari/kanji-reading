// 配信する問題データの型(docs/design/08-api-list.mdx API-001 / API-002)

export type ReadingType = "on" | "kun";
export type QuestionFormat = "single" | "word" | "sentence";

export interface Reading {
  /** 例: "上:のぼ(る)" */
  readingId: string;
  type: ReadingType;
  /** 漢字部分の読み(ひらがな) */
  kana: string;
  /** 送り仮名(訓読みのみ) */
  okurigana?: string;
}

export interface KanjiEntry {
  kanji: string;
  unitId: string;
  /** 学年内の配当表の掲載順(1 始まり) */
  order: number;
  /** 出題する読み */
  readings: Reading[];
  /**
   * 出題しないが、この漢字の読みとして正しいもの(常用漢字表の残りの音訓。表記は readings と同じ "さ(げる)" 形式)。
   * 単漢字問題の誤答に使わないための除外リスト。
   */
  excludedReadings?: string[];
}

export interface Ruby {
  start: number;
  length: number;
  kana: string;
}

export interface Highlight {
  start: number;
  length: number;
}

export interface Question {
  /** 公開後は不変 */
  questionId: string;
  kanji: string;
  readingId: string;
  format: QuestionFormat;
  prompt: string;
  ruby: Ruby[];
  /** 出題対象の漢字の範囲(下線・強調) */
  highlight: Highlight;
  /** 単漢字問題の音訓ヒント */
  hint?: "おんよみ" | "くんよみ";
  answer: string;
  distractors: [string, string, string];
  audioId: string;
}

export interface GradeData {
  grade: number;
  kanji: KanjiEntry[];
  questions: Question[];
}

export interface UnitInfo {
  unitId: string;
  order: number;
  title: string;
  kanji: string[];
}

export interface GradeInfo {
  grade: number;
  file: string;
  kanjiCount: number;
  units: UnitInfo[];
  audioBytes: number;
}

export interface Manifest {
  schemaVersion: number;
  dataVersion: string;
  grades: GradeInfo[];
  removedQuestionIds: string[];
}
