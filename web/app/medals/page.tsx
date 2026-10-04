"use client";

// SCR-008 メダル(FR-012)

import { useEffect, useState } from "react";
import { MEDALS } from "@/engine/medals";
import type { MedalAward } from "@/engine/types";
import { Loading, Screen } from "@/ui/Screen";
import { useRequireProfile } from "@/ui/useRequireProfile";

const formatDate = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
};

export default function MedalsPage() {
  const app = useRequireProfile();
  const [owned, setOwned] = useState<Map<string, MedalAward> | null>(null);
  const profileId = app?.profile?.id;
  const store = app?.store;

  useEffect(() => {
    if (!store || !profileId) return;
    let cancelled = false;
    void store.getMedals(profileId).then((ms) => !cancelled && setOwned(new Map(ms.map((m) => [m.medalId, m]))));
    return () => {
      cancelled = true;
    };
  }, [store, profileId]);

  if (!app || !owned) return <Loading />;

  return (
    <Screen title="メダル" back="/home/">
      <p className="mb-4 text-center text-[20px] font-bold" data-testid="medal-count">
        {owned.size} / {MEDALS.length} こ ゲット
      </p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {MEDALS.map((m) => {
          const award = owned.get(m.id);
          return (
            <li
              key={m.id}
              data-owned={award ? "true" : "false"}
              className={`flex flex-col items-center gap-1 rounded-lg bg-canvas p-4 text-center ring-1 ring-hairline ${award ? "" : "opacity-50"}`}
            >
              <span className={`text-[48px] leading-none ${award ? "[filter:drop-shadow(0_5px_12px_rgba(0,0,0,0.22))]" : "grayscale"}`}>
                {award ? m.emoji : "❔"}
              </span>
              <span className="text-[17px] font-bold">{m.name}</span>
              <span className="text-[13px] text-ink-muted">{m.description}</span>
              {award && <span className="text-[13px] text-ink-muted">{formatDate(award.awardedAt)}</span>}
            </li>
          );
        })}
      </ul>
    </Screen>
  );
}
