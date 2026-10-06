// サウンドプレイヤー(T-005: Web Audio API)。効果音は音源ファイルを持たず合成する。
// 読み上げ音声(FR-009)も同じ AudioContext で再生し、自動遷移中もアンロック状態を保つ。
// iOS の自動再生制限のため、最初のタップで AudioContext をアンロックする。

export type SoundEffect = "correct" | "wrong" | "complete";

type Note = { freq: number; at: number; dur: number; type?: OscillatorType; gain?: number };

const EFFECTS: Record<SoundEffect, Note[]> = {
  correct: [
    { freq: 1046.5, at: 0, dur: 0.12 },
    { freq: 1318.5, at: 0.1, dur: 0.22 },
  ],
  wrong: [
    { freq: 220, at: 0, dur: 0.18, type: "square", gain: 0.12 },
    { freq: 196, at: 0.16, dur: 0.26, type: "square", gain: 0.12 },
  ],
  complete: [
    { freq: 784, at: 0, dur: 0.14 },
    { freq: 988, at: 0.13, dur: 0.14 },
    { freq: 1175, at: 0.26, dur: 0.14 },
    { freq: 1568, at: 0.39, dur: 0.4 },
  ],
};

const VOICE_CACHE_LIMIT = 40;

export function voiceUrl(grade: number, audioId: string): string {
  return `/audio/${grade}/${audioId}.m4a`;
}

export class SoundPlayer {
  private ctx: AudioContext | null = null;
  enabled = true;
  voiceEnabled = true;
  private voices = new Map<string, Promise<AudioBuffer | null>>();
  private currentVoice: AudioBufferSourceNode | null = null;

  /** ユーザー操作のイベント内で呼ぶ */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  /** 読み上げ音声を先に取得・デコードしておく(回答直後に遅延なく再生するため) */
  preloadVoice(url: string): void {
    if (!this.voiceEnabled) return;
    void this.loadVoice(url);
  }

  private loadVoice(url: string): Promise<AudioBuffer | null> {
    let p = this.voices.get(url);
    if (!p) {
      p = (async () => {
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          const data = await res.arrayBuffer();
          const ctx = this.ctx ?? new OfflineAudioContext(1, 1, 24000);
          return await ctx.decodeAudioData(data);
        } catch {
          return null;
        }
      })();
      this.voices.set(url, p);
      // 古いものから捨てる
      if (this.voices.size > VOICE_CACHE_LIMIT) this.voices.delete(this.voices.keys().next().value!);
      void p.then((b) => b ?? this.voices.delete(url));
    }
    return p;
  }

  /**
   * 正解の読みを読み上げる。再生が終わる(または止められる)と resolve する。
   * 取得・再生に失敗した場合は何もしない(学習は継続)
   */
  async playVoice(url: string): Promise<void> {
    if (!this.voiceEnabled) return;
    const buffer = await this.loadVoice(url);
    const ctx = this.ctx;
    if (!buffer || !ctx || ctx.state !== "running") return;
    try {
      this.stopVoice();
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      const ended = new Promise<void>((resolve) => (src.onended = () => resolve()));
      src.start();
      this.currentVoice = src;
      await ended;
    } catch {
      // 再生失敗時は読み上げをスキップ
    }
  }

  stopVoice(): void {
    try {
      this.currentVoice?.stop();
    } catch {
      // 再生終了済み
    }
    this.currentVoice = null;
  }

  play(effect: SoundEffect): void {
    if (!this.enabled) return;
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    try {
      const t0 = ctx.currentTime + 0.01;
      for (const n of EFFECTS[effect]) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = n.type ?? "sine";
        osc.frequency.value = n.freq;
        const peak = n.gain ?? 0.25;
        g.gain.setValueAtTime(0.0001, t0 + n.at);
        g.gain.exponentialRampToValueAtTime(peak, t0 + n.at + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
        osc.connect(g).connect(ctx.destination);
        osc.start(t0 + n.at);
        osc.stop(t0 + n.at + n.dur + 0.02);
      }
    } catch {
      // 再生に失敗しても学習は継続する
    }
  }
}
