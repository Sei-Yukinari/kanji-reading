// 九九の音声入力(FR-031, T-011: Web Speech API)。答えの数だけを言わせ、認識結果を数に直して判定する。
// 使えないとき(未対応のブラウザ・オフライン・マイクの許可なし)は数字キーだけで回答する(NFR-016)。

const KANA_TOKENS: [string, number][] = [
  ["きゅう", 9], ["じゅう", 10], ["ぜろ", 0], ["れい", 0], ["いち", 1], ["さん", 3], ["よん", 4], ["ろく", 6],
  ["なな", 7], ["しち", 7], ["はち", 8], ["に", 2], ["し", 4], ["ご", 5], ["く", 9],
];
const KANJI_DIGITS: Record<string, number> = { 〇: 0, 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const TEN = 10;

const toHiragana = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/** 「十」を含む数字の並び(例: [2, 10, 4] → 24、[10, 2] → 12)を数にする。並びがおかしければ null */
function evaluate(tokens: number[]): number | null {
  if (tokens.length === 0) return null;
  let total = 0;
  let unit: number | null = null;
  let seenTen = false;
  for (const t of tokens) {
    if (t === TEN) {
      if (seenTen) return null;
      total += (unit ?? 1) * TEN;
      unit = null;
      seenTen = true;
    } else {
      if (unit !== null) return null;
      unit = t;
    }
  }
  return total + (unit ?? 0);
}

/**
 * 認識結果の 1 候補を数に直す。数が読み取れなければ null。
 * - 算用数字を含むときは最後の数(「34 12」のように唱えごと言った場合も答えの部分を取る)
 * - 漢数字・かな(じゅうに・にじゅうし 等)
 */
export function parseSpokenNumber(text: string): number | null {
  const normalized = text.normalize("NFKC");
  const digitRuns = normalized.match(/\d+/g);
  if (digitRuns) return Number(digitRuns[digitRuns.length - 1]);
  const s = toHiragana(normalized)
    .replace(/[\s、。,.!?！？ー〜~]/g, "")
    .replace(/(です|だよ|かな|こたえは|こたえ)$/u, "");

  const tokens: number[] = [];
  for (let i = 0; i < s.length; ) {
    if (s[i] in KANJI_DIGITS) {
      tokens.push(KANJI_DIGITS[s[i]]);
      i++;
      continue;
    }
    const hit = KANA_TOKENS.find(([k]) => s.startsWith(k, i));
    if (!hit) return null;
    tokens.push(hit[1]);
    i += hit[0].length;
  }
  return evaluate(tokens);
}

/**
 * 認識候補から回答の数を決める。候補のどれかが正解の数なら正解とする(子どもの発話は認識がゆれやすいため)。
 * 正解がなければ最初に読み取れた数。どれも読み取れなければ null(聞き取り直す)
 */
export function pickSpokenAnswer(alternatives: readonly string[], answer: number): number | null {
  const nums = alternatives.map(parseSpokenNumber).filter((n): n is number => n !== null);
  if (nums.includes(answer)) return answer;
  return nums[0] ?? null;
}

// --- ブラウザの音声認識 ---

interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}
interface RecognitionErrorEvent {
  error: string;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** 音声で答えられる環境か(認識には通信が必要なブラウザが多いため、オフライン時は使わない) */
export function speechInputAvailable(): boolean {
  return recognitionCtor() !== null && navigator.onLine;
}

/** 聞き取りを続けられないエラー(マイクの許可なし・通信なし 等)。no-speech / aborted は聞き直す */
const FATAL_ERRORS = new Set(["not-allowed", "service-not-allowed", "network", "audio-capture", "language-not-supported"]);

/**
 * 1 問ぶんの聞き取り。stop() するまで、無音で終わっても聞き直す。
 * onAlternatives は認識が確定するたびに候補の文字列を渡す。
 */
export class NumberListener {
  private rec: Recognition | null = null;
  private active = false;

  constructor(
    private readonly onAlternatives: (alternatives: string[]) => void,
    private readonly onFatal: (error: string) => void,
    private readonly onListening: (listening: boolean) => void,
  ) {}

  start(): void {
    const Ctor = recognitionCtor();
    if (!Ctor || this.active) return;
    this.active = true;
    this.listen(Ctor);
  }

  private listen(Ctor: RecognitionCtor) {
    const rec = new Ctor();
    rec.lang = "ja-JP";
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 5;
    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      if (!last?.isFinal) return;
      this.onAlternatives(Array.from(last, (alt) => alt.transcript));
    };
    rec.onerror = (e) => {
      if (FATAL_ERRORS.has(e.error)) {
        this.active = false;
        this.onFatal(e.error);
      }
    };
    rec.onend = () => {
      this.onListening(false);
      if (this.rec === rec) this.rec = null;
      if (this.active) this.listen(Ctor);
    };
    this.rec = rec;
    try {
      rec.start();
      this.onListening(true);
    } catch {
      this.active = false;
      this.onFatal("start-failed");
    }
  }

  stop(): void {
    this.active = false;
    const rec = this.rec;
    this.rec = null;
    try {
      rec?.abort();
    } catch {
      // 停止済み
    }
    this.onListening(false);
  }
}
