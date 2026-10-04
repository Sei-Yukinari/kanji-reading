"use client";

// SCR-007 習得状況(FR-014)

import { useEffect, useState } from "react";
import type { GradeData } from "@/data/types";
import { kanjiStatus, masterySummary, unitKanji } from "@/engine/progress";
import type { KanjiStatus, ReadingProgress } from "@/engine/types";
import { Loading, Screen } from "@/ui/Screen";
import { useRequireProfile } from "@/ui/useRequireProfile";

const STATUS_CLASS: Record<KanjiStatus, string> = {
  new: "bg-canvas text-ink-muted/50 ring-1 ring-hairline",
  learning: "bg-canvas text-ink ring-1 ring-hairline",
  mastered: "bg-primary-fill text-on-primary",
};
const STATUS_LABEL: Record<KanjiStatus, string> = { new: "まだ", learning: "れんしゅうちゅう", mastered: "おぼえた" };

export default function MasteryPage() {
  const app = useRequireProfile();
  const [state, setState] = useState<{ data: GradeData; progress: Map<string, ReadingProgress> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const grade = app?.profile?.lastGrade ?? 1;
  const profileId = app?.profile?.id;
  const store = app?.store;
  const loadGrade = app?.loadGrade;

  useEffect(() => {
    if (!store || !profileId || !loadGrade) return;
    let cancelled = false;
    Promise.all([loadGrade(grade), store.getProgress(profileId, grade)])
      .then(([data, progress]) => !cancelled && setState({ data, progress }))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "よみこめませんでした"));
    return () => {
      cancelled = true;
    };
  }, [store, profileId, grade, loadGrade]);

  if (!app) return <Loading />;
  const total = state && masterySummary(state.data.kanji, state.progress);
  const units = state ? [...new Set(state.data.kanji.map((k) => k.unitId))] : [];

  return (
    <Screen title={`${grade}ねん おぼえた かんじ`} back="/home/">
      {error && <p className="text-center text-wrong">{error}</p>}
      {total && (
        <p className="mb-4 rounded-lg bg-canvas p-4 text-center text-[22px] font-bold ring-1 ring-hairline" data-testid="mastery-total">
          おぼえた かんじ {total.mastered} / {total.total}
          <span className="ml-2 text-[17px] text-ink-muted">({Math.round(total.rate * 100)}%)</span>
        </p>
      )}
      <ul className="mb-4 flex flex-wrap gap-3 text-[15px]">
        {(Object.keys(STATUS_LABEL) as KanjiStatus[]).map((s) => (
          <li key={s} className="flex items-center gap-1">
            <span className={`flex size-6 items-center justify-center rounded text-[12px] ${STATUS_CLASS[s]}`}>{s === "mastered" ? "✓" : "字"}</span>
            {STATUS_LABEL[s]}
          </li>
        ))}
      </ul>
      {state &&
        units.map((u, i) => {
          const ks = unitKanji(state.data, u);
          const sum = masterySummary(ks, state.progress);
          return (
            <section key={u} className="mb-6">
              <h2 className="mb-2 flex items-baseline justify-between text-[20px] font-bold">
                ステージ {i + 1}
                <span className="text-[15px] font-normal text-ink-muted">
                  {sum.mastered}/{sum.total}
                </span>
              </h2>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2">
                {ks.map((k) => {
                  const s = kanjiStatus(k, state.progress);
                  return (
                    <li
                      key={k.kanji}
                      aria-label={`${k.kanji} ${STATUS_LABEL[s]}`}
                      className={`font-kanji relative flex aspect-square min-h-14 items-center justify-center rounded-lg text-[32px] ${STATUS_CLASS[s]}`}
                    >
                      {k.kanji}
                      {s === "mastered" && <span className="absolute top-0.5 right-1 font-sans text-[12px]">✓</span>}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
    </Screen>
  );
}
