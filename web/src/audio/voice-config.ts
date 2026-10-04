// 読み上げ音声の生成設定(T-004)。値を変えると audioId が変わり、全音声が再生成される。
// キャラクターは仮採用(顧客の了承待ち)。変更時は speaker と credit を差し替える。

export const VOICE = {
  engine: "voicevox",
  /** VOICEVOX の話者 ID(ずんだもん・ノーマル) */
  speaker: 3,
  speedScale: 0.9,
  /** 利用規約で必須のクレジット表記(NFR-015) */
  credit: "VOICEVOX:ずんだもん",
} as const;
