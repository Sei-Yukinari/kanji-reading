"use client";

// SCR-004 単元選択(FR-015)

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { GradeData } from "@/data/types";
import { masterySummary, unitKanji, type MasterySummary } from "@/engine/progress";
import { Loading, Screen } from "@/ui/Screen";
import { useRequireProfile } from "@/ui/useRequireProfile";

function percent(n: number, total: number): number {
  return total ? (n / total) * 100 : 0;
}

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
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <span className="flex flex-col items-end text-[15px] text-ink-muted">
                  <span>
                    おぼえた {r.summary.mastered}/{r.summary.total}
                  </span>
                  {r.summary.learning > 0 && <span className="text-[13px]">れんしゅうちゅう {r.summary.learning}</span>}
                </span>
              </span>
              <span className="font-kanji truncate text-[28px] tracking-wider">{r.kanji.join("")}</span>
              {/* 習得済みに加えて学習中も薄い色で重ね、遊ぶたびに進んでいることを見せる */}
              <span className="flex h-2 overflow-hidden rounded-pill bg-parchment" aria-hidden>
                <span className="block h-full bg-primary" style={{ width: `${percent(r.summary.mastered, r.summary.total)}%` }} />
                <span className="block h-full bg-primary/30" style={{ width: `${percent(r.summary.learning, r.summary.total)}%` }} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
