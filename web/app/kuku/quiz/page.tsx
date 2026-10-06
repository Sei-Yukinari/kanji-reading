"use client";

// SCR-013 九九の出題(FR-027〜FR-033, FR-011)

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp, type KukuResult } from "@/app-state/AppProvider";
import { COUNTDOWN_SECONDS, KUKU_FEEDBACK_MS, TIME_ATTACK_PENALTY_MS } from "@/config";
import { FACT_BY_ID, GORO, chantText, kukuVoiceUrl } from "@/kuku/data";
import {
  buildKukuSet,
  computeKukuOutcome,
  dansKeyOf,
  isSlow,
  kukuTimeAttackTime,
  type AnswerMethod,
  type KukuAnswer,
  type KukuConfig,
  type KukuProgress,
  type KukuQuestion,
} from "@/kuku/engine";
import { NumberListener, pickSpokenAnswer, speechInputAvailable } from "@/kuku/speech";
import { Triangle } from "@/kuku/ui/Triangle";
import { TriangleChart, cellKeyOf } from "@/kuku/ui/TriangleChart";
import { ConfirmDialog } from "@/ui/ConfirmDialog";
import { Loading } from "@/ui/Screen";
import { useRequireProfile } from "@/ui/useRequireProfile";

type Phase = "loading" | "countdown" | "question" | "feedback" | "saving";

const VOICE_INPUT_KEY = "kukuVoiceInput";

/** 問題文の「?」の位置にある数(入力中の数・回答後の正解を入れる) */
function ExprPrompt({ q, slot }: { q: KukuQuestion; slot: React.ReactNode }) {
  const f = FACT_BY_ID.get(q.factId)!;
  const part = (pos: "left" | "right" | "top", n: number) => (q.hidden === pos ? slot : <span>{n}</span>);
  return (
    <p className="flex items-center justify-center gap-3 text-[56px] font-bold tabular-nums sm:text-[72px]" data-testid="prompt">
      {part("left", f.a)}
      <span className="text-ink-muted">×</span>
      {part("right", f.b)}
      <span className="text-ink-muted">=</span>
      {part("top", f.product)}
    </p>
  );
}

export default function KukuQuizPage() {
  const app = useRequireProfile();
  const router = useRouter();
  const config = app?.kukuConfig ?? null;

  useEffect(() => {
    // 再読み込み等で出題設定がない場合は九九ホームへ
    if (app && !config) router.replace("/kuku/");
  }, [app, config, router]);

  if (!app || !config) return <Loading />;
  return <Quiz config={config} />;
}

function Quiz({ config }: { config: KukuConfig }) {
  const { store, profile, sound, setKukuResult } = useApp();
  const router = useRouter();
  const isTA = config.mode === "time_attack";
  const feedbackMs = isTA ? KUKU_FEEDBACK_MS.time_attack : KUKU_FEEDBACK_MS.practice;

  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<KukuQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [given, setGiven] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(0);
  const [progress, setProgress] = useState<Map<string, KukuProgress>>(new Map());
  const [reviewIds, setReviewIds] = useState<Set<string>>(new Set());
  // 音声入力(FR-031)
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [voiceInput, setVoiceInput] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);

  const answersRef = useRef<KukuAnswer[]>([]);
  const shownAtRef = useRef<number | null>(null);
  const carriedRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishingRef = useRef(false);
  const listenerRef = useRef<NumberListener | null>(null);
  /** 音声の認識結果を処理する関数(最新の問題を参照するため ref 経由で呼ぶ) */
  const onSpokenRef = useRef<(alts: string[]) => void>(() => {});

  // --- 出題セットの準備 ---
  useEffect(() => {
    if (!store || !profile) return;
    let cancelled = false;
    (async () => {
      try {
        const [p, review, voicePref] = await Promise.all([
          store.getKukuProgress(profile.id),
          store.getKukuReview(profile.id),
          store.getMeta<boolean>(VOICE_INPUT_KEY),
        ]);
        if (cancelled) return;
        const set = buildKukuSet({ config, progress: p, reviewItems: review });
        if (set.length === 0) throw new Error(config.mode === "review" ? "ふくしゅうする くくは もう ないよ!" : "もんだいが ありません");
        setProgress(p);
        setReviewIds(new Set(review.map((r) => r.factId)));
        setQuestions(set);
        const available = speechInputAvailable();
        setVoiceAvailable(available);
        setVoiceInput(available && !!voicePref);
        setPhase(isTA ? "countdown" : "question");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "もんだいが よみこめませんでした");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store, profile, config, isTA]);

  // --- タイムアタックのカウントダウン ---
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      setPhase("question");
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // 問題を表示したら計測開始。唱えの音声を先読みしておく
  useEffect(() => {
    if (phase !== "question") return;
    shownAtRef.current = performance.now();
    carriedRef.current = 0;
    const q = questions[index];
    if (q) sound.preloadVoice(kukuVoiceUrl(FACT_BY_ID.get(q.factId)!.audioId));
  }, [phase, index, questions, sound]);

  // 音声入力: 問題の表示中だけ聞き取る(唱えの音声を拾わないよう、正誤表示中は止める)
  useEffect(() => {
    if (!voiceInput || phase !== "question" || paused || confirmQuit) return;
    const listener = new NumberListener(
      (alts) => onSpokenRef.current(alts),
      () => {
        setVoiceInput(false);
        setVoiceNote("こえが つかえないので、えらんで こたえてね");
      },
      setListening,
    );
    listenerRef.current = listener;
    listener.start();
    return () => {
      listener.stop();
      listenerRef.current = null;
    };
  }, [voiceInput, phase, index, paused, confirmQuit]);

  // タイムアタックの経過時間表示
  useEffect(() => {
    if (!isTA || phase === "loading" || phase === "countdown") return;
    const t = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(t);
  }, [isTA, phase]);

  const currentElapsed = () => carriedRef.current + (shownAtRef.current === null ? 0 : performance.now() - shownAtRef.current);

  // --- バックグラウンド移行時の一時停止(タイムアタックのみ) ---
  useEffect(() => {
    if (!isTA) return;
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      if (shownAtRef.current !== null) {
        carriedRef.current = currentElapsed();
        shownAtRef.current = null;
        setPaused(true);
      } else if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        setPaused(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [isTA]);

  // --- セット完了: まとめて保存して結果へ ---
  const finish = useCallback(async () => {
    if (!store || !profile || finishingRef.current) return;
    finishingRef.current = true;
    setPhase("saving");
    sound.play("complete");
    const answers = answersRef.current;
    const result: KukuResult = { config, questions, answers, saveFailed: false };
    try {
      const outcome = computeKukuOutcome(config.mode, answers, progress);
      let best;
      if (isTA) {
        const timeMs = kukuTimeAttackTime(answers);
        const dansKey = dansKeyOf(config.dans);
        result.timeMs = timeMs;
        result.previousBestMs = (await store.getKukuBest(profile.id, dansKey))?.timeMs;
        if (result.previousBestMs === undefined || timeMs < result.previousBestMs) {
          result.newBest = true;
          best = { profileId: profile.id, dansKey, timeMs, achievedAt: Date.now() };
        }
      }
      await store.saveKukuResult(profile.id, outcome, best);
    } catch (e) {
      console.error(e);
      result.saveFailed = true;
    }
    setKukuResult(result);
    router.replace("/kuku/result/");
  }, [store, profile, sound, config, questions, progress, isTA, setKukuResult, router]);

  const next = useCallback(() => {
    if (phase === "saving") return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current);
    sound.stopVoice();
    setGiven(null);
    setVoiceNote(null);
    if (index + 1 >= questions.length) {
      void finish();
    } else {
      setIndex((i) => i + 1);
      setPhase("question");
    }
  }, [phase, index, questions.length, finish, sound]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current);
    },
    [],
  );

  // --- 回答(4 択: FR-030、音声: FR-031、速さの判定: FR-033) ---
  const submit = (value: number, method: AnswerMethod) => {
    if (phase !== "question" || given !== null || paused || !profile) return;
    listenerRef.current?.stop();
    const q = questions[index];
    const f = FACT_BY_ID.get(q.factId)!;
    const elapsedMs = Math.round(currentElapsed());
    shownAtRef.current = null;
    const correct = value === q.answer;
    const slow = correct && isSlow(elapsedMs, method);
    setGiven(value);
    setPhase("feedback");
    sound.play(correct ? "correct" : "wrong");
    // 唱えを聞かせる(FR-029)。効果音と重ならないよう少し遅らせる
    voiceTimerRef.current = setTimeout(() => void sound.playVoice(kukuVoiceUrl(f.audioId)), 250);
    answersRef.current = [
      ...answersRef.current,
      { profileId: profile.id, question: q, given: value, correct, slow, method, elapsedMs, answeredAt: Date.now() },
    ];
    timerRef.current = setTimeout(next, correct ? feedbackMs.correct : feedbackMs.wrong);
  };

  onSpokenRef.current = (alts) => {
    const q = questions[index];
    if (!q || phase !== "question") return;
    const n = pickSpokenAnswer(alts, q.answer);
    if (n === null) {
      setVoiceNote(`「${alts[0] ?? ""}」? もういちど いってね`);
      return;
    }
    submit(n, "voice");
  };

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
        <p className="text-[22px] font-bold text-wrong">{error}</p>
        <button type="button" className="press min-h-14 rounded-pill bg-primary-fill px-8 text-[20px] font-bold text-on-primary" onClick={() => router.replace("/kuku/")}>
          くくの ホームへ
        </button>
      </div>
    );
  }
  if (phase === "loading" || questions.length === 0) return <Loading />;

  if (phase === "countdown") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <p className="text-[24px] font-bold">よーい…</p>
        <p key={countdown} className="pop-in text-[120px] font-bold text-primary" aria-live="assertive">
          {countdown > 0 ? countdown : "スタート!"}
        </p>
      </div>
    );
  }

  const q = questions[Math.min(index, questions.length - 1)];
  const f = FACT_BY_ID.get(q.factId)!;
  const answered = given !== null;
  const correct = answered && given === q.answer;
  const lastAnswer = answersRef.current[answersRef.current.length - 1];
  const slow = answered && lastAnswer?.slow;
  const penalty = answersRef.current.filter((a) => !a.correct).length * TIME_ATTACK_PENALTY_MS;
  const elapsedTotal = answersRef.current.reduce((t, a) => t + a.elapsedMs, 0) + penalty + (phase === "question" && !paused ? currentElapsed() : 0);
  void now;
  const goro = f.triangleId ? GORO[f.triangleId] : undefined;

  // 「?」の場所: 入力中は入力した数、回答後は正解
  const slot = (
    <span
      className={`inline-flex min-w-[1.6em] items-center justify-center rounded-lg px-2 ring-4 ${
        answered ? (correct ? "text-correct ring-correct" : "text-wrong ring-wrong") : "text-primary ring-primary/40"
      }`}
      data-testid="slot"
    >
      {answered ? q.answer : "?"}
    </span>
  );

  const instruction = q.format === "triangle" ? "さんかくの ? に はいる かずは?" : q.hidden === "top" ? "こたえは?" : "? に はいる かずは?";
  const showDots = questions.length <= 12;

  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pt-[max(12px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))]"
      onClick={() => {
        // 正誤表示中は画面タップで次へ
        if (phase === "feedback") next();
      }}
    >
      <header className="flex min-h-11 items-center gap-3">
        <button
          type="button"
          className="press min-h-11 rounded-pill bg-canvas px-4 text-[17px] font-bold ring-1 ring-hairline"
          onClick={(e) => {
            e.stopPropagation();
            if (timerRef.current) clearTimeout(timerRef.current);
            if (shownAtRef.current !== null) {
              carriedRef.current = currentElapsed();
              shownAtRef.current = null;
            }
            setConfirmQuit(true);
          }}
        >
          やめる
        </button>
        {showDots ? (
          <ol className="flex flex-1 items-center justify-center gap-1.5" aria-label={`${index + 1}もんめ / ${questions.length}もん`}>
            {questions.map((_, i) => {
              const a = answersRef.current[i];
              return <li key={i} className={`size-3 rounded-full ${a ? (a.correct ? "bg-correct" : "bg-wrong") : i === index ? "bg-primary" : "bg-hairline"}`} />;
            })}
          </ol>
        ) : (
          <div className="flex flex-1 items-center" role="progressbar" aria-label={`${index + 1}もんめ / ${questions.length}もん`} aria-valuenow={index + 1} aria-valuemax={questions.length}>
            <span className="block h-2 w-full overflow-hidden rounded-pill bg-hairline">
              <span className="block h-full bg-primary" style={{ width: `${((index + (answered ? 1 : 0)) / questions.length) * 100}%` }} />
            </span>
          </div>
        )}
        <span className="min-w-16 text-right text-[17px] font-bold tabular-nums" aria-label="けいか じかん">
          {isTA ? `${(elapsedTotal / 1000).toFixed(1)}びょう` : `${index + 1}/${questions.length}`}
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-4 py-4 landscape:flex-row landscape:items-stretch">
        <section className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg bg-canvas p-5 ring-1 ring-hairline" data-answer={q.answer} data-format={q.format}>
          <span className="text-[17px] font-bold text-ink-muted">{instruction}</span>
          {q.format === "triangle" ? (
            <div className="w-52 sm:w-64" data-testid="prompt">
              <Triangle top={f.product} left={f.a} right={f.b} hidden={answered ? undefined : q.hidden} status={answered ? (correct ? "mastered" : "review") : "learning"} className="block w-full" />
            </div>
          ) : (
            <ExprPrompt q={q} slot={slot} />
          )}
          <div className="flex min-h-11 flex-col items-center gap-1 text-center" aria-live="polite">
            {answered ? (
              <>
                <p className={`text-[26px] font-bold ${correct ? "text-correct" : "text-wrong"}`} data-testid="feedback">
                  {correct ? (slow ? "⭕️ せいかい! つぎは もっと はやく" : "⭕️ せいかい!") : `❌ こたえは ${q.answer}`}
                </p>
                <p className="text-[20px] font-bold tabular-nums">
                  {f.a} × {f.b} = {f.product}
                  <span className="ml-2 font-normal">「{chantText(f)}」</span>
                </p>
                {goro && !isTA && <p className="text-[16px] text-ink-muted">💡 {goro}</p>}
              </>
            ) : (
              voiceNote && <p className="text-[17px] text-wrong">{voiceNote}</p>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-3 landscape:w-[46%]">
          {answered ? (
            // 全体図のどこにあるかを見せる(FR-028)
            <div className="rounded-lg bg-canvas p-3 ring-1 ring-hairline" data-testid="answer-chart">
              <TriangleChart progress={progress} reviewIds={reviewIds} highlight={cellKeyOf(f)} showLegend={false} />
            </div>
          ) : (
            <>
              {voiceAvailable && (
                <button
                  type="button"
                  aria-pressed={voiceInput}
                  onClick={(e) => {
                    e.stopPropagation();
                    const on = !voiceInput;
                    setVoiceInput(on);
                    setVoiceNote(null);
                    void store?.setMeta(VOICE_INPUT_KEY, on);
                  }}
                  className={`press flex min-h-12 items-center justify-center gap-2 rounded-pill text-[17px] font-bold ring-1 ring-hairline ${voiceInput ? "bg-primary-fill text-on-primary" : "bg-canvas"}`}
                >
                  🎤 {voiceInput ? (listening ? "きいてるよ… こたえを いってね" : "こえで こたえる: オン") : "こえで こたえる"}
                </button>
              )}
              <div className="grid grid-cols-2 gap-3" role="group" aria-label="こたえを えらぶ">
                {q.choices.map((c) => (
                  <button
                    key={c}
                    type="button"
                    data-testid="choice"
                    data-correct={c === q.answer ? "true" : undefined}
                    disabled={phase !== "question" || paused}
                    onClick={(e) => {
                      e.stopPropagation();
                      submit(c, "choice");
                    }}
                    className="press flex min-h-[72px] items-center justify-center rounded-lg bg-canvas text-[34px] font-bold tabular-nums ring-1 ring-hairline sm:min-h-24 sm:text-[40px]"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {confirmQuit && (
        <ConfirmDialog
          message="とちゅうで やめる? きろくは のこらないよ"
          confirmLabel="やめる"
          danger
          onConfirm={() => router.replace("/kuku/")}
          onCancel={() => {
            setConfirmQuit(false);
            if (phase === "feedback") next();
            else if (phase === "question") shownAtRef.current = performance.now();
          }}
        />
      )}
      {paused && !confirmQuit && (
        <ConfirmDialog
          message="おやすみちゅう。つづける?"
          confirmLabel="やめる"
          danger
          onConfirm={() => router.replace("/kuku/")}
          onCancel={() => {
            setPaused(false);
            if (phase === "question") shownAtRef.current = performance.now();
            else if (phase === "feedback") next();
          }}
        />
      )}
    </div>
  );
}
