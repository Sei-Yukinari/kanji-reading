"use client";

// 全体図のマスをタップしたときの詳細(FR-029, FR-032): 唱えの音声と語呂合わせ

import { useEffect } from "react";
import type { SoundPlayer } from "../../audio/sound";
import { Button } from "../../ui/Button";
import { GORO, chantText, kukuVoiceUrl } from "../data";
import type { CellStatus } from "../engine";
import { factsOfCell } from "./TriangleChart";
import { STATUS_LABEL, Triangle } from "./Triangle";

export function CellSheet({
  cellKey,
  status,
  sound,
  voiceOn,
  onClose,
}: {
  cellKey: string;
  status: CellStatus;
  sound: SoundPlayer;
  voiceOn: boolean;
  onClose(): void;
}) {
  const facts = factsOfCell(cellKey);
  const first = facts[0];
  const goro = GORO[cellKey];

  useEffect(() => {
    void sound.playVoice(kukuVoiceUrl(first.audioId));
    return () => sound.stopVoice();
  }, [sound, first.audioId]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={`${first.a} かける ${first.b}`} onClick={onClose}>
      <div className="pop-in w-full max-w-sm rounded-lg bg-canvas p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-4">
          <Triangle top={first.product} left={Math.min(first.a, first.b)} right={Math.max(first.a, first.b)} status={status} className="w-24 shrink-0" />
          <p className="text-[15px] font-bold text-ink-muted">{STATUS_LABEL[status]}</p>
        </div>
        <ul className="mb-3 flex flex-col gap-2">
          {facts.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                disabled={!voiceOn}
                onClick={() => void sound.playVoice(kukuVoiceUrl(f.audioId))}
                className="press flex w-full items-center justify-between gap-3 rounded-lg bg-parchment px-4 py-3 text-left disabled:active:scale-100"
              >
                <span className="flex flex-col">
                  <span className="text-[24px] font-bold tabular-nums">
                    {f.a} × {f.b} = {f.product}
                  </span>
                  <span className="text-[17px]" data-testid="chant">
                    {chantText(f)}
                  </span>
                </span>
                {voiceOn && <span aria-label="きく">🔈</span>}
              </button>
            </li>
          ))}
        </ul>
        {goro && (
          <p className="mb-4 rounded-lg bg-parchment px-4 py-3 text-[17px]" data-testid="goro">
            💡 {goro}
          </p>
        )}
        <Button variant="secondary" className="w-full" onClick={onClose}>
          とじる
        </Button>
      </div>
    </div>
  );
}
