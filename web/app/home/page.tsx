"use client";

// SCR-003 ホーム(FR-001, FR-011, FR-013)

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { prefetchVoices } from "@/audio/prefetch";
import { GRADES } from "@/config";
import { isStandalone } from "@/sw/platform";
import { Loading, Screen } from "@/ui/Screen";
import { useRequireProfile } from "@/ui/useRequireProfile";

export default function HomePage() {
  const app = useRequireProfile();
  const router = useRouter();
  const [reviewCount, setReviewCount] = useState<number | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  const profileId = app?.profile?.id;
  const grade = app?.profile?.lastGrade ?? 1;
  const store = app?.store;

  useEffect(() => {
    if (!store || !profileId) return;
    let cancelled = false;
    void store.getReviewItems(profileId, grade).then((items) => !cancelled && setReviewCount(items.length));
    void store.getMeta<boolean>("installBannerDismissed").then((d) => !cancelled && setShowBanner(!d && !isStandalone()));
    return () => {
      cancelled = true;
    };
  }, [store, profileId, grade]);

  const manifestForPrefetch = app?.manifest;
  const voiceOn = app?.settings?.voice;
  const loadGradeFn = app?.loadGrade;
  useEffect(() => {
    if (voiceOn && manifestForPrefetch && loadGradeFn) prefetchVoices(manifestForPrefetch, grade, loadGradeFn);
  }, [voiceOn, manifestForPrefetch, grade, loadGradeFn]);

  if (!app || !app.profile) return <Loading />;
  const { profile, manifest, manifestError, setGrade, setQuizConfig } = app;
  const available = new Set(manifest?.grades.map((g) => g.grade) ?? []);
  const gradeReady = available.has(grade);

  const startQuiz = (mode: "time_attack" | "review") => {
    setQuizConfig({ mode, grade });
    router.push("/quiz/");
  };

  return (
    <Screen
      right={
        <div className="flex w-full items-center justify-between">
          <Link href="/profiles/" className="press flex min-h-11 items-center gap-2 rounded-pill bg-canvas py-1 pr-4 pl-2 ring-1 ring-hairline">
            <span className="text-[28px] leading-none">{profile.icon}</span>
            <span className="max-w-[10em] truncate text-[17px] font-bold">{profile.nickname}</span>
          </Link>
          <Link href="/settings/" aria-label="せってい" className="press flex size-11 items-center justify-center rounded-full bg-canvas text-[22px] ring-1 ring-hairline">
            ⚙️
          </Link>
        </div>
      }
    >
      {showBanner && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-canvas p-3 ring-1 ring-hairline">
          <Link href="/install/" className="flex-1 text-[17px] font-bold text-primary">
            📲 ホームがめんに ついかすると、きろくが きえにくく なるよ
          </Link>
          <button
            type="button"
            aria-label="とじる"
            className="flex size-11 items-center justify-center text-ink-muted"
            onClick={() => {
              setShowBanner(false);
              void app.store?.setMeta("installBannerDismissed", true);
            }}
          >
            ✕
          </button>
        </div>
      )}

      {manifestError && (
        <p role="alert" className="mb-4 rounded-lg bg-canvas p-4 text-center text-[17px] text-wrong ring-1 ring-wrong/30">
          {manifestError}
        </p>
      )}

      <nav aria-label="がくねん" className="mb-5 grid grid-cols-6 gap-1 rounded-pill bg-canvas p-1 ring-1 ring-hairline">
        {GRADES.map((g) => {
          const ok = available.has(g);
          const selected = g === grade;
          return (
            <button
              key={g}
              type="button"
              aria-pressed={selected}
              disabled={!ok}
              onClick={() => void setGrade(g)}
              className={`press flex min-h-12 flex-col items-center justify-center rounded-pill text-[17px] font-bold ${selected ? "bg-primary-fill text-on-primary" : "text-ink"} disabled:text-ink-muted/60`}
            >
              {g}ねん
            </button>
          );
        })}
      </nav>
      {GRADES.some((g) => !available.has(g)) && manifest && (
        <p className="-mt-3 mb-5 text-center text-[13px] text-ink-muted">
          {GRADES.filter((g) => !available.has(g)).join("・")}ねんの もんだいは じゅんびちゅう
        </p>
      )}

      <div className="flex flex-col gap-4">
        <ModeCard emoji="✏️" title="れんしゅう" sub="ステージを えらんで 10もん" disabled={!gradeReady} onClick={() => router.push("/units/")} />
        <ModeCard emoji="⏱️" title="タイムアタック" sub="10もんを どれだけ はやく とけるかな" disabled={!gradeReady} onClick={() => startQuiz("time_attack")} />
        <ModeCard
          emoji="🔁"
          title="ふくしゅう"
          sub={reviewCount ? "まちがえた もんだいに チャレンジ" : "まちがえた もんだいは まだ ないよ"}
          badge={reviewCount ?? 0}
          disabled={!gradeReady || !reviewCount}
          onClick={() => startQuiz("review")}
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <Link href="/mastery/" className="press flex min-h-16 items-center justify-center gap-2 rounded-lg bg-canvas text-[18px] font-bold ring-1 ring-hairline">
          📖 おぼえた かんじ
        </Link>
        <Link href="/medals/" className="press flex min-h-16 items-center justify-center gap-2 rounded-lg bg-canvas text-[18px] font-bold ring-1 ring-hairline">
          🏅 メダル
        </Link>
      </div>
    </Screen>
  );
}

function ModeCard({
  emoji,
  title,
  sub,
  badge,
  disabled,
  onClick,
}: {
  emoji: string;
  title: string;
  sub: string;
  badge?: number;
  disabled?: boolean;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="press flex min-h-24 items-center gap-4 rounded-lg bg-canvas px-5 py-4 text-left ring-1 ring-hairline disabled:opacity-45"
    >
      <span className="text-[40px] leading-none">{emoji}</span>
      <span className="flex flex-1 flex-col">
        <span className="text-[24px] font-bold">{title}</span>
        <span className="text-[15px] text-ink-muted">{sub}</span>
      </span>
      {badge !== undefined && badge > 0 && (
        <span className="flex min-w-9 items-center justify-center rounded-pill bg-primary-fill px-2 py-1 text-[17px] font-bold text-on-primary">{badge}</span>
      )}
    </button>
  );
}
