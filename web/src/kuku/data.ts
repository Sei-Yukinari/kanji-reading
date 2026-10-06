// 九九のデータ(FR-026, FR-029, FR-032)。81 式の唱えと、三角視算表(2〜9 の段の 36 組)の並び、語呂合わせ。
// 唱えの読み・語呂合わせは人手でチェックする(NFR-017)。チェック用 CSV は scripts/export-kuku-review.ts で書き出す。

import { VOICE } from "../audio/voice-config";

/** 唱え: [かける数の部分, 積の部分]。例: 3×3 →「さざんが」「く」 */
type Chant = readonly [string, string];

/** 段ごとの唱え(index 0 が ×1)。教科書で一般的な読み */
const CHANTS: Record<number, readonly Chant[]> = {
  1: [["いんいちが", "いち"], ["いんにが", "に"], ["いんさんが", "さん"], ["いんしが", "し"], ["いんごが", "ご"], ["いんろくが", "ろく"], ["いんしちが", "しち"], ["いんはちが", "はち"], ["いんくが", "く"]],
  2: [["にいちが", "に"], ["ににんが", "し"], ["にさんが", "ろく"], ["にしが", "はち"], ["にご", "じゅう"], ["にろく", "じゅうに"], ["にしち", "じゅうし"], ["にはち", "じゅうろく"], ["にく", "じゅうはち"]],
  3: [["さんいちが", "さん"], ["さんにが", "ろく"], ["さざんが", "く"], ["さんし", "じゅうに"], ["さんご", "じゅうご"], ["さぶろく", "じゅうはち"], ["さんしち", "にじゅういち"], ["さんぱ", "にじゅうし"], ["さんく", "にじゅうしち"]],
  4: [["しいちが", "し"], ["しにが", "はち"], ["しさん", "じゅうに"], ["しし", "じゅうろく"], ["しご", "にじゅう"], ["しろく", "にじゅうし"], ["ししち", "にじゅうはち"], ["しは", "さんじゅうに"], ["しく", "さんじゅうろく"]],
  5: [["ごいちが", "ご"], ["ごに", "じゅう"], ["ごさん", "じゅうご"], ["ごし", "にじゅう"], ["ごご", "にじゅうご"], ["ごろく", "さんじゅう"], ["ごしち", "さんじゅうご"], ["ごは", "しじゅう"], ["ごっく", "しじゅうご"]],
  6: [["ろくいちが", "ろく"], ["ろくに", "じゅうに"], ["ろくさん", "じゅうはち"], ["ろくし", "にじゅうし"], ["ろくご", "さんじゅう"], ["ろくろく", "さんじゅうろく"], ["ろくしち", "しじゅうに"], ["ろくは", "しじゅうはち"], ["ろっく", "ごじゅうし"]],
  7: [["しちいちが", "しち"], ["しちに", "じゅうし"], ["しちさん", "にじゅういち"], ["しちし", "にじゅうはち"], ["しちご", "さんじゅうご"], ["しちろく", "しじゅうに"], ["しちしち", "しじゅうく"], ["しちは", "ごじゅうろく"], ["しちく", "ろくじゅうさん"]],
  8: [["はちいちが", "はち"], ["はちに", "じゅうろく"], ["はちさん", "にじゅうし"], ["はちし", "さんじゅうに"], ["はちご", "しじゅう"], ["はちろく", "しじゅうはち"], ["はちしち", "ごじゅうろく"], ["はっぱ", "ろくじゅうし"], ["はっく", "しちじゅうに"]],
  9: [["くいちが", "く"], ["くに", "じゅうはち"], ["くさん", "にじゅうしち"], ["くし", "さんじゅうろく"], ["くご", "しじゅうご"], ["くろく", "ごじゅうし"], ["くしち", "ろくじゅうさん"], ["くは", "しちじゅうに"], ["くく", "はちじゅういち"]],
};

/**
 * 語呂合わせ(オリジナル。人手チェック前の下書き)。三角 1 組(小さいほうの数-大きいほうの数)に 1 つ。
 * 覚えにくい 6・7・8 の段を中心に 20 組。カッコ内は語呂の元になる数。
 */
export const GORO: Readonly<Record<string, string>> = {
  "3-6": "さぶろうくんの ゼッケンは じゅうはち(18)ばん",
  "3-7": "さんしちの にい(21)さん",
  "3-8": "さんぱで にし(24)へ",
  "3-9": "さんきゅう! ふな(27)さん",
  "4-6": "しろくまが にし(24)へ",
  "4-7": "ししちゃんちの にわ(28)",
  "4-8": "しばいぬ さんにん(32)",
  "4-9": "しくしく ないても さぶろう(36)",
  "5-7": "ごしちの うみの さんご(35)",
  "5-9": "ごっくん のんで しごと(45)",
  "6-6": "ろくろで つくる さぶろう(36)の ちゃわん",
  "6-7": "ろくしち よふかし(42)",
  "6-8": "ろっぱの しわ(48)よせ",
  "6-9": "ロックで ごし(54)ごし",
  "7-7": "しちしち しく(49)しく",
  "7-8": "しちはで ごろ(56)ごろ",
  "7-9": "しちくの むさ(63)さび",
  "8-8": "はっぱに むし(64)",
  "8-9": "はっくしょん! なに(72)?",
  "9-9": "くくの おわりは はい(81)、おしまい",
};

export const DANS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** 九九の 1 式(a の段の a × b) */
export interface KukuFact {
  /** 例: "3x4" */
  id: string;
  a: number;
  b: number;
  product: number;
  /** 唱えの前半・後半(かな) */
  chant: Chant;
  /** 唱えの音声ファイル名(読みと音声設定が変わると変わる) */
  audioId: string;
  /** 属する三角(1 の段は null) */
  triangleId: string | null;
}

/** 三角視算表の 1 組(small ≤ large、2〜9) */
export interface Triangle {
  /** 例: "3-4" */
  id: string;
  small: number;
  large: number;
  product: number;
}

export const factId = (a: number, b: number) => `${a}x${b}`;
export const triangleIdOf = (a: number, b: number) => (a < 2 || b < 2 ? null : `${Math.min(a, b)}-${Math.max(a, b)}`);

/** 32bit FNV-1a。ブラウザとビルドスクリプトの両方で同じ値を返す */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function kukuAudioIdOf(chant: Chant): string {
  const { engine, speaker, speedScale } = VOICE;
  return fnv1a(JSON.stringify([engine, speaker, speedScale, "kuku", chant]));
}

export const KUKU_FACTS: readonly KukuFact[] = DANS.flatMap((a) =>
  CHANTS[a].map((chant, i) => {
    const b = i + 1;
    return { id: factId(a, b), a, b, product: a * b, chant, audioId: kukuAudioIdOf(chant), triangleId: triangleIdOf(a, b) };
  }),
);

export const FACT_BY_ID: ReadonlyMap<string, KukuFact> = new Map(KUKU_FACTS.map((f) => [f.id, f]));

export const TRIANGLES: readonly Triangle[] = DANS.filter((s) => s >= 2).flatMap((small) =>
  DANS.filter((l) => l >= small).map((large) => ({ id: `${small}-${large}`, small, large, product: small * large })),
);

/** 唱えの表示(例: 「さざんが く」) */
export const chantText = (f: KukuFact) => `${f.chant[0]} ${f.chant[1]}`;

export function kukuVoiceUrl(audioId: string): string {
  return `/audio/kuku/${audioId}.m4a`;
}

/** 三角に属する式(a×b と b×a。同じ数どうしは 1 式) */
export function factsOfTriangle(t: Triangle): KukuFact[] {
  const ids = t.small === t.large ? [factId(t.small, t.large)] : [factId(t.small, t.large), factId(t.large, t.small)];
  return ids.map((id) => FACT_BY_ID.get(id)!);
}

/** 1 の段の列の 1 マス(1×n と n×1) */
export function factsOfOneCell(n: number): KukuFact[] {
  const ids = n === 1 ? [factId(1, 1)] : [factId(1, n), factId(n, 1)];
  return ids.map((id) => FACT_BY_ID.get(id)!);
}
