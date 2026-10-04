"use client";

// SCR-005 出題(FR-002〜FR-008, FR-011, FR-013, FR-022)

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp, type QuizConfig, type QuizResult } from "@/app-state/AppProvider";
import { COUNTDOWN_SECONDS, FEEDBACK_MS, TIME_ATTACK_PENALTY_MS } from "@/config";
import type { GradeData } from "@/data/types";
import { evaluateMedals } from "@/engine/medals";
import { computeSessionOutcome, isNewBest, timeAttackTime } from "@/engine/progress";
import { buildQuestionSet } from "@/engine/question-set";
import type { AnswerRecord, QuizItem, ReadingProgress, SessionRecord } from "@/engine/types";
import { ConfirmDialog } from "@/ui/ConfirmDialog";
import { QuestionText } from "@/ui/QuestionText";
import { Loading } from "@/ui/Screen";
import { useRequireProfile } from "@/ui/useRequireProfile";

type Phase = "loading" | "countdown" | "question" | "feedback" | "saving";

export default function QuizPage() {
  const app = useRequireProfile();
  const router = useRouter();
  const config = app?.quizConfig ?? null;

  useEffect(() => {
    // 再読み込み等で出題設定がない場合は中断扱いでホームへ(画面遷移図「例外時の遷移」)
    if (app && !config) router.replace("/home/");
  }, [app, config, router]);

  if (!app || !config) return <Loading />;
  return <Quiz config={config} />;
}

function Quiz({ config }: { config: QuizConfig }) {
  const { store, profile, loadGrade, sound, setResult } = useApp();
  const router = useRouter();
  const isTA = config.mode === "time_attack";
  const feedbackMs = isTA ? FEEDBACK_MS.time_attack : FEEDBACK_MS.practice;

  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<QuizItem[]>([]);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(0);

  const dataRef = useRef<GradeData | null>(null);
  const progressRef = useRef<Map<string, ReadingProgress>>(new Map());
  const answersRef = useRef<AnswerRecord[]>([]);
  const startedAtRef = useRef(Date.now());
  /** 現在の問題の計測開始時刻(performance.now)。一時停止中は null */
  const shownAtRef = useRef<number | null>(null);
  /** 一時停止までに経過した現在の問題の時間 */
  const carriedRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** finish を 2 回走らせない(保存の二重実行防止) */
  const finishingRef = useRef(false);

  // --- 出題セットの準備 ---
  useEffect(() => {
    if (!store || !profile) return;
    let cancelled = false;
    (async () => {
      try {
        const [data, progress, reviewItems] = await Promise.all([
          loadGrade(config.grade),
          store.getProgress(profile.id, config.grade),
          store.getReviewItems(profile.id, config.grade),
        ]);
        if (cancelled) return;
        const set = buildQuestionSet({ mode: config.mode, data, unitId: config.unitId, progress, reviewItems });
        if (set.length === 0) throw new Error(config.mode === "review" ? "ふくしゅうする もんだいは もう ないよ!" : "もんだいが ありません");
        dataRef.current = data;
        progressRef.current = progress;
        setItems(set);
        setPhase(isTA ? "countdown" : "question");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "もんだいが よみこめませんでした");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store, profile, loadGrade, config, isTA]);

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

  // 問題を表示したら計測開始
  useEffect(() => {
    if (phase === "question") {
      shownAtRef.current = performance.now();
      carriedRef.current = 0;
    }
  }, [phase, index]);

  // タイムアタックの経過時間表示
  useEffect(() => {
    if (!isTA || phase === "loading" || phase === "countdown") return;
    const t = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(t);
  }, [isTA, phase]);

  const currentElapsed = () => carriedRef.current + (shownAtRef.current === null ? 0 : performance.now() - shownAtRef.current);

  // --- バックグラウンド移行時の一時停止(タイムアタックのみ。FR-011 業務ルール) ---
  useEffect(() => {
    if (!isTA) return;
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      if (shownAtRef.current !== null) {
        // 計測中: 経過時間を保持して止める
        carriedRef.current = currentElapsed();
        shownAtRef.current = null;
        setPaused(true);
      } else if (timerRef.current) {
        // 正誤表示中: 自動遷移を止め、次の問題の計測が裏で始まらないようにする
        clearTimeout(timerRef.current);
        timerRef.current = null;
        setPaused(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [isTA]);

  const resume = () => {
    setPaused(false);
    if (phase === "question") shownAtRef.current = performance.now();
    else if (phase === "feedback") next();
  };

  // --- セット完了: まとめて保存して結果へ ---
  const finish = useCallback(async () => {
    if (!store || !profile || !dataRef.current || finishingRef.current) return;
    finishingRef.current = true;
    setPhase("saving");
    sound.play("complete");
    const answers = answersRef.current;
    const data = dataRef.current;
    const finishedAt = Date.now();
    const correctCount = answers.filter((a) => a.correct).length;
    const timeMs = isTA ? timeAttackTime(answers) : undefined;

    let saveFailed = false;
    let newMedals: string[] = [];
    let previousBestMs: number | undefined;
    const session: SessionRecord = {
      profileId: profile.id,
      mode: config.mode,
      grade: config.grade,
      unitId: config.unitId,
      startedAt: startedAtRef.current,
      finishedAt,
      total: answers.length,
      correctCount,
      timeMs,
    };
    try {
      const outcome = computeSessionOutcome(config.mode, config.grade, answers, progressRef.current);
      let best;
      if (timeMs !== undefined) {
        previousBestMs = (await store.getBest(profile.id, config.grade))?.timeMs;
        if (isNewBest(timeMs, previousBestMs)) {
          session.newBest = true;
          best = { profileId: profile.id, grade: config.grade, timeMs, achievedAt: finishedAt };
        }
      }
      const progressAfter = new Map(progressRef.current);
      for (const p of outcome.progress) progressAfter.set(p.readingId, p);
      const [pastSessions, owned] = await Promise.all([store.getSessions(profile.id), store.getMedals(profile.id)]);
      newMedals = evaluateMedals({
        sessions: [...pastSessions, session],
        current: session,
        progress: progressAfter,
        data,
        owned: new Set(owned.map((m) => m.medalId)),
      });
      await store.saveSessionResult({
        session,
        answers,
        outcome,
        best,
        medals: newMedals.map((medalId) => ({ profileId: profile.id, medalId, awardedAt: finishedAt })),
      });
    } catch (e) {
      console.error(e);
      saveFailed = true;
    }
    const result: QuizResult = { config, items, answers, session, newMedals, previousBestMs, saveFailed };
    setResult(result);
    router.replace("/result/");
  }, [store, profile, sound, isTA, config, items, setResult, router]);

  const next = useCallback(() => {
    if (phase === "saving") return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setChosen(null);
    if (index + 1 >= items.length) {
      void finish();
    } else {
      setIndex((i) => i + 1);
      setPhase("question");
    }
  }, [phase, index, items.length, finish]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // --- 回答(FR-006, FR-007) ---
  const choose = (choice: string) => {
    if (phase !== "question" || chosen !== null || paused || !profile) return;
    const item = items[index];
    const elapsedMs = Math.round(currentElapsed());
    shownAtRef.current = null;
    const correct = choice === item.question.answer;
    setChosen(choice);
    setPhase("feedback");
    sound.play(correct ? "correct" : "wrong");
    answersRef.current = [
      ...answersRef.current,
      {
        profileId: profile.id,
        questionId: item.question.questionId,
        readingId: item.question.readingId,
        kanji: item.question.kanji,
        chosen: choice,
        correct,
        elapsedMs,
        answeredAt: Date.now(),
      },
    ];
    timerRef.current = setTimeout(next, correct ? feedbackMs.correct : feedbackMs.wrong);
  };

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
        <p className="text-[22px] font-bold text-wrong">{error}</p>
        <button type="button" className="press min-h-14 rounded-pill bg-primary px-8 text-[20px] font-bold text-white" onClick={() => router.replace("/home/")}>
          ホームへ
        </button>
      </div>
    );
  }
  if (phase === "loading" || items.length === 0) return <Loading />;

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

  const item = items[Math.min(index, items.length - 1)];
  const q = item.question;
  const answered = chosen !== null;
  const correct = answered && chosen === q.answer;
  const penalty = answersRef.current.filter((a) => !a.correct).length * TIME_ATTACK_PENALTY_MS;
  const elapsedTotal =
    answersRef.current.reduce((t, a) => t + a.elapsedMs, 0) + penalty + (phase === "question" && !paused ? currentElapsed() : 0);
  void now;

  const promptSize =
    // 単漢字 120px 以上・熟語 80px 以上(docs/design/01-ui-ux.mdx)。熟語は最長 3 字なので幅 360px でも収まる
    q.format === "single" ? "text-[120px] sm:text-[160px] leading-none" : q.format === "word" ? "text-[80px] sm:text-[96px] leading-tight" : "text-[30px] sm:text-[44px] leading-[1.9] [word-break:keep-all]";

  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pt-[max(12px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))]"
      onClick={() => {
        // 正誤表示中は画面タップで次へ(FR-007)
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
        <ol className="flex flex-1 items-center justify-center gap-1.5" aria-label={`${index + 1}もんめ / ${items.length}もん`}>
          {items.map((_, i) => {
            const a = answersRef.current[i];
            return (
              <li
                key={i}
                className={`size-3 rounded-full ${a ? (a.correct ? "bg-correct" : "bg-wrong") : i === index ? "bg-primary" : "bg-hairline"}`}
              />
            );
          })}
        </ol>
        <span className="min-w-16 text-right text-[17px] font-bold tabular-nums" aria-label="けいか じかん">
          {isTA ? `${(elapsedTotal / 1000).toFixed(1)}びょう` : `${index + 1}/${items.length}`}
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-6 py-4 landscape:flex-row landscape:items-center">
        <section className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg bg-canvas p-6 ring-1 ring-hairline landscape:self-stretch">
          {q.hint && (
            <span className="rounded-pill bg-parchment px-4 py-1 text-[17px] font-bold text-ink-muted">{q.hint}で よむと?</span>
          )}
          {q.format === "word" && <span className="text-[17px] font-bold text-ink-muted">ぜんぶの よみかたは?</span>}
          {q.format === "sentence" && <span className="text-[17px] font-bold text-ink-muted">せんの ひいてある かんじの よみかたは?</span>}
          <p className={`font-kanji text-center ${promptSize}`} data-testid="prompt">
            <QuestionText prompt={q.prompt} ruby={q.ruby} highlight={q.highlight} underline={q.format === "sentence"} />
          </p>
          <p className={`min-h-10 text-[28px] font-bold ${correct ? "text-correct" : "text-wrong"}`} aria-live="polite" data-testid="feedback">
            {answered && (correct ? `⭕️ せいかい! ${q.answer}` : `❌ こたえは「${q.answer}」`)}
          </p>
        </section>

        <div className="grid grid-cols-2 gap-3 landscape:w-[46%]">
          {item.choices.map((c) => {
            const isAnswer = c === q.answer;
            const isChosen = c === chosen;
            let state = "ring-1 ring-hairline";
            if (answered && isAnswer) state = "ring-4 ring-correct";
            else if (answered && isChosen) state = "ring-4 ring-wrong";
            return (
              <button
                key={c}
                type="button"
                disabled={answered}
                data-testid="choice"
                data-correct={isAnswer ? "true" : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  choose(c);
                }}
                className={`press relative flex min-h-[72px] items-center justify-center rounded-lg bg-canvas px-2 py-4 text-[26px] font-bold sm:min-h-24 sm:text-[30px] ${state} ${answered && !isAnswer && !isChosen ? "opacity-45" : ""}`}
              >
                {answered && (isAnswer || isChosen) && (
                  <span className="absolute top-1 left-2 text-[20px]" aria-hidden>
                    {isAnswer ? "⭕️" : "❌"}
                  </span>
                )}
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {confirmQuit && (
        <ConfirmDialog
          message="とちゅうで やめる? きろくは のこらないよ"
          confirmLabel="やめる"
          danger
          onConfirm={() => router.replace("/home/")}
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
          onConfirm={() => router.replace("/home/")}
          onCancel={resume}
        />
      )}
    </div>
  );
}
