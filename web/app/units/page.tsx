"use client";

// SCR-004 単元選択(FR-015)

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { GradeData } from "@/data/types";
import { masterySummary, unitKanji, type MasterySummary } from "@/engine/progress";
import { Loading, Screen } from "@/ui/Screen";
import { useRequireProfile } from "@/ui/useRequireProfile";

export default function UnitsPage() {
  const app = useRequireProfile();
  const router = useRouter();
  const [rows, setRows] = useState<{ unitId: string; title: string; kanji: string[]; summary: MasterySummary }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const grade = app?.profile?.lastGrade ?? 1;
  const profileId = app?.profile?.id;
  const store = app?.store;
  const loadGrade = app?.loadGrade;

  useEffect(() => {
    if (!store || !profileId || !loadGrade) return;
    let cancelled = false;
    (async () => {
      try {
        const [data, progress]: [GradeData, Awaited<ReturnType<typeof store.getProgress>>] = await Promise.all([
          loadGrade(grade),
          store.getProgress(profileId, grade),
        ]);
        const units = [...new Set(data.kanji.map((k) => k.unitId))];
        if (!cancelled) {
          setRows(
            units.map((u, i) => {
              const ks = unitKanji(data, u);
              return { unitId: u, title: `ステージ ${i + 1}`, kanji: ks.map((k) => k.kanji), summary: masterySummary(ks, progress) };
            }),
          );
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "もんだいが よみこめませんでした");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store, profileId, grade, loadGrade]);

  if (!app) return <Loading />;

  return (
    <Screen title={`${grade}ねん れんしゅう`} back="/home/">
      {error && <p className="rounded-lg bg-canvas p-4 text-center text-wrong">{error}</p>}
      {!rows && !error && <p className="text-center text-ink-muted">よみこみちゅう…</p>}
      <ul className="grid gap-4 sm:grid-cols-2">
        {rows?.map((r) => (
          <li key={r.unitId}>
            <button
              type="button"
              className="press flex w-full flex-col gap-2 rounded-lg bg-canvas p-5 text-left ring-1 ring-hairline"
              onClick={() => {
                app.setQuizConfig({ mode: "practice", grade, unitId: r.unitId });
                router.push("/quiz/");
              }}
            >
              <span className="flex items-center justify-between">
                <span className="text-[22px] font-bold">{r.title}</span>
                <span className="text-[15px] text-ink-muted">
                  おぼえた {r.summary.mastered}/{r.summary.total}
                </span>
              </span>
              <span className="font-kanji truncate text-[28px] tracking-wider">{r.kanji.join("")}</span>
              <span className="h-2 overflow-hidden rounded-pill bg-parchment" aria-hidden>
                <span className="block h-full rounded-pill bg-primary" style={{ width: `${Math.round(r.summary.rate * 100)}%` }} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
