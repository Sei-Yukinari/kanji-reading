"use client";

// SCR-012 九九の段選択(FR-027)

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DANS } from "@/kuku/data";
import type { KukuOrder } from "@/kuku/engine";
import { Button } from "@/ui/Button";
import { Loading, Screen } from "@/ui/Screen";
import { useRequireProfile } from "@/ui/useRequireProfile";

const lastDansKey = (profileId: string) => `kukuLastDans:${profileId}`;

export default function KukuSelectPage() {
  const app = useRequireProfile();
  const router = useRouter();
  const config = app?.kukuConfig ?? null;
  const [dans, setDans] = useState<number[] | null>(null);
  const [order, setOrder] = useState<KukuOrder>("sequential");

  const store = app?.store;
  const profileId = app?.profile?.id;

  useEffect(() => {
    if (app && !config) router.replace("/kuku/");
  }, [app, config, router]);

  useEffect(() => {
    if (!store || !profileId) return;
    let cancelled = false;
    void store.getMeta<number[]>(lastDansKey(profileId)).then((d) => !cancelled && setDans(d?.length ? d : [2]));
    return () => {
      cancelled = true;
    };
  }, [store, profileId]);

  if (!app || !config || !dans) return <Loading />;
  const isTA = config.mode === "time_attack";
  const all = dans.length === DANS.length;

  const toggle = (d: number) => setDans((cur) => (cur!.includes(d) ? cur!.filter((x) => x !== d) : [...cur!, d].sort((a, b) => a - b)));

  const start = () => {
    if (profileId) void store?.setMeta(lastDansKey(profileId), dans);
    // タイムアタックは常にバラバラ
    app.setKukuConfig({ mode: config.mode, dans, order: isTA ? "random" : order });
    router.push("/kuku/quiz/");
  };

  return (
    <Screen title={isTA ? "くく タイムアタック" : "くく れんしゅう"} back="/kuku/">
      <section aria-labelledby="dan-title" className="mb-6">
        <h2 id="dan-title" className="mb-3 text-[20px] font-bold">
          だんを えらぶ(いくつでも)
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {DANS.map((d) => {
            const on = dans.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(d)}
                className={`press min-h-16 rounded-lg text-[22px] font-bold ring-1 ring-hairline ${on ? "bg-primary-fill text-on-primary" : "bg-canvas"}`}
              >
                {on && <span aria-hidden>✓ </span>}
                {d}のだん
              </button>
            );
          })}
        </div>
        <button
          type="button"
          aria-pressed={all}
          onClick={() => setDans(all ? [] : [...DANS])}
          className={`press mt-3 min-h-14 w-full rounded-lg text-[20px] font-bold ring-1 ring-hairline ${all ? "bg-primary-fill text-on-primary" : "bg-canvas"}`}
        >
          {all && <span aria-hidden>✓ </span>}
          ぜんぶ まぜる
        </button>
      </section>

      {!isTA && (
        <section aria-labelledby="order-title" className="mb-6">
          <h2 id="order-title" className="mb-3 text-[20px] font-bold">
            でかた
          </h2>
          <div className="grid grid-cols-2 gap-1 rounded-pill bg-canvas p-1 ring-1 ring-hairline">
            {(
              [
                ["sequential", "じゅんばん"],
                ["random", "バラバラ"],
              ] as const
            ).map(([o, label]) => (
              <button
                key={o}
                type="button"
                aria-pressed={order === o}
                onClick={() => setOrder(o)}
                className={`press min-h-12 rounded-pill text-[18px] font-bold ${order === o ? "bg-primary-fill text-on-primary" : "text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[15px] text-ink-muted">
            {order === "sequential" ? "となえる じゅんばんに でるよ" : "さんかくや「? × 4 = 12」も まざって でるよ"}
          </p>
        </section>
      )}

      <Button className="mt-auto w-full" disabled={dans.length === 0} onClick={start}>
        はじめる
      </Button>
    </Screen>
  );
}
