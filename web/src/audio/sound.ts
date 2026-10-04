// サウンドプレイヤー(T-005: Web Audio API)。効果音は音源ファイルを持たず合成する。
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

export class SoundPlayer {
  private ctx: AudioContext | null = null;
  enabled = true;

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
