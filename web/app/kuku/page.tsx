"use client";

// SCR-011 九九ホーム(FR-025, FR-026, FR-029, FR-032, FR-033)

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { prefetchUrls } from "@/audio/prefetch";
import { DANS, KUKU_FACTS, kukuVoiceUrl } from "@/kuku/data";
import { cellStatus, type KukuProgress, type KukuReviewItem } from "@/kuku/engine";
import { CellSheet } from "@/kuku/ui/CellSheet";
import { TriangleChart, cellKeyOf, factsOfCell } from "@/kuku/ui/TriangleChart";
import { HomeHeader } from "@/ui/HomeHeader";
import { ModeCard } from "@/ui/ModeCard";
import { Loading, Screen } from "@/ui/Screen";
import { SubjectSwitch } from "@/ui/SubjectSwitch";
import { useRequireProfile } from "@/ui/useRequireProfile";

export default function KukuHomePage() {
  const app = useRequireProfile();
  const router = useRouter();
  const [state, setState] = useState<{ progress: Map<string, KukuProgress>; review: KukuReviewItem[] } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  /** 段の通し再生中の段と式 */
  const [playing, setPlaying] = useState<{ dan: number; factId: string } | null>(null);
  const playTokenRef = useRef(0);

  const store = app?.store;
  const profileId = app?.profile?.id;
  const sound = app?.sound;
  const voiceOn = app?.settings?.voice ?? true;

  useEffect(() => {
    if (!store || !profileId) return;
    let cancelled = false;
    void Promise.all([store.getKukuProgress(profileId), store.getKukuReview(profileId)]).then(
      ([progress, review]) => !cancelled && setState({ progress, review }),
    );
    return () => {
      cancelled = true;
    };
  }, [store, profileId]);

  useEffect(() => {
    if (voiceOn) prefetchUrls(KUKU_FACTS.map((f) => kukuVoiceUrl(f.audioId)));
  }, [voiceOn]);

  // 画面を離れたら通し再生を止める
  useEffect(
    () => () => {
      playTokenRef.current++;
      sound?.stopVoice();
    },
    [sound],
  );

  if (!app || !app.profile || !state || !sound) return <Loading />;
  const reviewIds = new Set(state.review.map((r) => r.factId));

  const stopDan = () => {
    playTokenRef.current++;
    sound.stopVoice();
    setPlaying(null);
  };

  /** 段の唱えを順に再生し、再生中の式の三角を強調する(FR-029) */
  const playDan = async (dan: number) => {
    const token = ++playTokenRef.current;
    for (const f of KUKU_FACTS.filter((x) => x.a === dan)) {
      if (playTokenRef.current !== token) return;
      setPlaying({ dan, factId: f.id });
      await sound.playVoice(kukuVoiceUrl(f.audioId));
      await new Promise((r) => setTimeout(r, 250));
    }
    if (playTokenRef.current === token) setPlaying(null);
  };

  const goSelect = (mode: "practice" | "time_attack") => {
    stopDan();
    app.setKukuConfig({ mode, dans: [], order: "random" });
    router.push("/kuku/select/");
  };

  const playingFact = playing ? KUKU_FACTS.find((f) => f.id === playing.factId) : undefined;

  return (
    <Screen right={<HomeHeader profile={app.profile} />}>
      <SubjectSwitch current="kuku" />

      <div className="flex flex-col gap-4">
        <ModeCard emoji="✏️" title="れんしゅう" sub="だんを えらんで れんしゅう" onClick={() => goSelect("practice")} />
        <ModeCard emoji="⏱️" title="タイムアタック" sub="どれだけ はやく とけるかな" onClick={() => goSelect("time_attack")} />
        <ModeCard
          emoji="🔁"
          title="ふくしゅう"
          sub={reviewIds.size ? "まちがえた・じかんが かかった くく" : "ふくしゅうする くくは まだ ないよ"}
          badge={reviewIds.size}
          disabled={!reviewIds.size}
          onClick={() => {
            stopDan();
            app.setKukuConfig({ mode: "review", dans: [], order: "random" });
            router.push("/kuku/quiz/");
          }}
        />
      </div>

      <section className="mt-6 rounded-lg bg-canvas p-3 ring-1 ring-hairline sm:p-5" aria-labelledby="chart-title">
        <h2 id="chart-title" className="mb-1 text-[20px] font-bold">
          さんかく くくひょう
        </h2>
        <p className="mb-3 text-[15px] text-ink-muted">さんかくを タップすると となえかたが きけるよ</p>
        <TriangleChart
          progress={state.progress}
          reviewIds={reviewIds}
          highlight={playingFact ? cellKeyOf(playingFact) : null}
          onSelect={(k) => {
            stopDan();
            setSelected(k);
          }}
        />
      </section>

      {voiceOn && (
        <section className="mt-6" aria-labelledby="listen-title">
          <h2 id="listen-title" className="mb-3 text-[20px] font-bold">
            だんを きく
          </h2>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-9">
            {DANS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={playing?.dan === d}
                onClick={() => (playing?.dan === d ? stopDan() : void playDan(d))}
                className={`press min-h-12 rounded-lg text-[17px] font-bold ring-1 ring-hairline ${playing?.dan === d ? "bg-primary-fill text-on-primary" : "bg-canvas"}`}
              >
                {playing?.dan === d ? "■ とめる" : `${d}のだん`}
              </button>
            ))}
          </div>
          {playingFact && (
            <p className="mt-3 text-center text-[22px] font-bold tabular-nums" aria-live="polite">
              {playingFact.a} × {playingFact.b} = {playingFact.product}
            </p>
          )}
        </section>
      )}

      {selected && (
        <CellSheet
          cellKey={selected}
          status={cellStatus(factsOfCell(selected), state.progress, reviewIds)}
          sound={sound}
          voiceOn={voiceOn}
          onClose={() => setSelected(null)}
        />
      )}
    </Screen>
  );
}
