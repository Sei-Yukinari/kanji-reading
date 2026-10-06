"use client";

// SCR-014 九九の結果(FR-027, FR-011, FR-033)

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FACT_BY_ID, chantText, kukuVoiceUrl, type KukuFact } from "@/kuku/data";
import { Button } from "@/ui/Button";
import { Loading, Screen } from "@/ui/Screen";
import { useRequireProfile } from "@/ui/useRequireProfile";

const formatSec = (ms: number) => `${(ms / 1000).toFixed(1)}びょう`;

export default function KukuResultPage() {
  const app = useRequireProfile();
  const router = useRouter();
  const result = app?.kukuResult ?? null;

  useEffect(() => {
    if (app && !result) router.replace("/kuku/");
  }, [app, result, router]);

  // ふくしゅうは復習対象が残っているときだけ「もういちど」を出す
  const [reviewLeft, setReviewLeft] = useState<number | null>(null);
  const store = app?.store;
  const profileId = app?.profile?.id;
  useEffect(() => {
    if (!store || !profileId || !result || result.config.mode !== "review") return;
    let cancelled = false;
    void store.getKukuReview(profileId).then((items) => !cancelled && setReviewLeft(items.length));
    return () => {
      cancelled = true;
    };
  }, [store, profileId, result]);

  if (!app || !result) return <Loading />;
  const { answers, config } = result;
  const correctCount = answers.filter((a) => a.correct).length;
  const perfect = correctCount === answers.length;
  const factsOf = (pred: (a: (typeof answers)[number]) => boolean) => [
    ...new Map(answers.filter(pred).map((a) => [a.question.factId, FACT_BY_ID.get(a.question.factId)!])).values(),
  ];
  const wrong = factsOf((a) => !a.correct);
  const slow = factsOf((a) => a.correct && a.slow).filter((f) => !wrong.includes(f));
  const canRetry = config.mode !== "review" || (reviewLeft ?? 0) > 0;
  const modeLabel = config.mode === "time_attack" ? "タイムアタック" : config.mode === "review" ? "ふくしゅう" : "れんしゅう";
  const voiceOn = app.settings?.voice ?? true;

  const factList = (title: string, facts: KukuFact[], testId: string) =>
    facts.length > 0 && (
      <section className="mb-6" data-testid={testId}>
        <h2 className="mb-3 text-[20px] font-bold">{title}</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {facts.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                disabled={!voiceOn}
                aria-label={`${f.a} かける ${f.b} の となえかたを きく`}
                onClick={() => void app.sound.playVoice(kukuVoiceUrl(f.audioId))}
                className="press flex w-full items-center justify-between gap-3 rounded-lg bg-canvas px-4 py-3 text-left ring-1 ring-hairline disabled:active:scale-100"
              >
                <span className="text-[24px] font-bold tabular-nums">
                  {f.a} × {f.b} = {f.product}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-[17px]">
                  {chantText(f)}
                  {voiceOn && <span aria-hidden>🔈</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <Screen title={`くく ${modeLabel} けっか`}>
      <section className="mb-6 flex flex-col items-center gap-2 rounded-lg bg-canvas p-6 text-center ring-1 ring-hairline">
        <p className="text-[56px] leading-none">{perfect ? "🎉" : correctCount >= answers.length / 2 ? "😊" : "💪"}</p>
        <p className="text-[32px] font-bold" data-testid="score">
          {correctCount} / {answers.length} もん せいかい!
        </p>
        {result.timeMs !== undefined && (
          <div className="mt-2 flex flex-col items-center gap-1">
            <p className="text-[28px] font-bold tabular-nums">タイム {formatSec(result.timeMs)}</p>
            {result.newBest ? (
              <p className="pop-in rounded-pill bg-primary-fill px-5 py-1 text-[20px] font-bold text-on-primary">じこベスト こうしん!</p>
            ) : (
              result.previousBestMs !== undefined && <p className="text-[17px] text-ink-muted">じこベスト {formatSec(result.previousBestMs)}</p>
            )}
            <p className="text-[15px] text-ink-muted">まちがえると 1もん 5びょう プラス</p>
          </div>
        )}
        {result.saveFailed && <p className="mt-2 text-[15px] text-wrong">きろくが ほぞんできませんでした</p>}
      </section>

      {factList("まちがえた くく", wrong, "wrong-list")}
      {factList("じかんが かかった くく", slow, "slow-list")}
      {(wrong.length > 0 || slow.length > 0) && <p className="-mt-4 mb-6 text-[15px] text-ink-muted">「ふくしゅう」で もういちど れんしゅうできるよ</p>}

      <div className="mt-auto flex flex-col gap-3 sm:flex-row">
        {canRetry && (
          <Button
            className="flex-1"
            onClick={() => {
              app.setKukuConfig({ ...config });
              router.replace("/kuku/quiz/");
            }}
          >
            もういちど
          </Button>
        )}
        <Button variant="secondary" className="flex-1" onClick={() => router.replace("/kuku/")}>
          くくの ホームへ
        </Button>
      </div>
    </Screen>
  );
}
