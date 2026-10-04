"use client";

// SCR-006 結果(FR-002, FR-011, FR-012)

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { voiceUrl } from "@/audio/sound";
import { MEDALS } from "@/engine/medals";
import { Button } from "@/ui/Button";
import { QuestionText } from "@/ui/QuestionText";
import { Loading, Screen } from "@/ui/Screen";
import { useRequireProfile } from "@/ui/useRequireProfile";

const formatSec = (ms: number) => `${(ms / 1000).toFixed(1)}びょう`;

export default function ResultPage() {
  const app = useRequireProfile();
  const router = useRouter();
  const result = app?.result ?? null;

  useEffect(() => {
    if (app && !result) router.replace("/home/");
  }, [app, result, router]);

  // ふくしゅうは復習対象が残っているときだけ「もういちど」を出す(全問正解直後は空セットになるため)
  const [reviewLeft, setReviewLeft] = useState<number | null>(null);
  const store = app?.store;
  const profileId = app?.profile?.id;
  useEffect(() => {
    if (!store || !profileId || !result || result.config.mode !== "review") return;
    let cancelled = false;
    void store.getReviewItems(profileId, result.config.grade).then((items) => !cancelled && setReviewLeft(items.length));
    return () => {
      cancelled = true;
    };
  }, [store, profileId, result]);

  if (!app || !result) return <Loading />;
  const { session, answers, items, newMedals, previousBestMs, saveFailed, config } = result;
  const canRetry = config.mode !== "review" || (reviewLeft ?? 0) > 0;
  const wrong = answers.filter((a) => !a.correct).map((a) => items.find((i) => i.question.questionId === a.questionId)!.question);
  const perfect = session.correctCount === session.total;
  const modeLabel = config.mode === "time_attack" ? "タイムアタック" : config.mode === "review" ? "ふくしゅう" : "れんしゅう";

  return (
    <Screen title={`${modeLabel} けっか`}>
      <section className="mb-6 flex flex-col items-center gap-2 rounded-lg bg-canvas p-6 text-center ring-1 ring-hairline">
        <p className="text-[56px] leading-none">{perfect ? "🎉" : session.correctCount >= session.total / 2 ? "😊" : "💪"}</p>
        <p className="text-[32px] font-bold" data-testid="score">
          {session.correctCount} / {session.total} もん せいかい!
        </p>
        {session.timeMs !== undefined && (
          <div className="mt-2 flex flex-col items-center gap-1">
            <p className="text-[28px] font-bold tabular-nums">タイム {formatSec(session.timeMs)}</p>
            {session.newBest ? (
              <p className="pop-in rounded-pill bg-primary-fill px-5 py-1 text-[20px] font-bold text-on-primary">じこベスト こうしん!</p>
            ) : (
              previousBestMs !== undefined && <p className="text-[17px] text-ink-muted">じこベスト {formatSec(previousBestMs)}</p>
            )}
            <p className="text-[15px] text-ink-muted">まちがえると 1もん 5びょう プラス</p>
          </div>
        )}
        {saveFailed && <p className="mt-2 text-[15px] text-wrong">きろくが ほぞんできませんでした</p>}
      </section>

      {newMedals.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-[20px] font-bold">あたらしい メダル</h2>
          <ul className="flex flex-wrap gap-3">
            {newMedals.map((id) => {
              const m = MEDALS.find((x) => x.id === id);
              return (
                <li key={id} className="pop-in flex items-center gap-3 rounded-lg bg-canvas px-4 py-3 ring-1 ring-hairline">
                  <span className="text-[40px] leading-none [filter:drop-shadow(0_5px_12px_rgba(0,0,0,0.22))]">{m?.emoji ?? "🏅"}</span>
                  <span className="text-[18px] font-bold">{m?.name ?? id}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {wrong.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-[20px] font-bold">まちがえた もんだい</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {wrong.map((q) => (
              <li key={q.questionId}>
                <button
                  type="button"
                  aria-label={`${q.answer} を よみあげ`}
                  disabled={!app.settings?.voice}
                  onClick={() => void app.sound.playVoice(voiceUrl(config.grade, q.audioId))}
                  className="press flex w-full items-center justify-between gap-3 rounded-lg bg-canvas px-4 py-3 text-left ring-1 ring-hairline disabled:active:scale-100"
                >
                  <span className="font-kanji min-w-0 truncate text-[26px]">
                    <QuestionText prompt={q.prompt} ruby={q.ruby} highlight={q.highlight} underline={q.format === "sentence"} />
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-[20px] font-bold text-correct">
                    {q.answer}
                    {app.settings?.voice && <span aria-hidden>🔈</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[15px] text-ink-muted">まちがえた もんだいは「ふくしゅう」で もういちど できるよ</p>
        </section>
      )}

      <div className="mt-auto flex flex-col gap-3 sm:flex-row">
        {canRetry && (
          <Button
            className="flex-1"
            onClick={() => {
              app.setQuizConfig({ ...config });
              router.replace("/quiz/");
            }}
          >
            もういちど
          </Button>
        )}
        <Button variant="secondary" className="flex-1" onClick={() => router.replace("/home/")}>
          ホームへ
        </Button>
      </div>
    </Screen>
  );
}
