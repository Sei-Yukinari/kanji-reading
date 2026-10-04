"use client";

import Link from "next/link";
import { useApp } from "../app-state/AppProvider";

export function Screen({
  title,
  back,
  right,
  children,
  className = "",
}: {
  title?: string;
  /** 戻り先。指定時は左上に「もどる」を出す */
  back?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const { store } = useApp();
  return (
    <div className="fade-in mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 pt-[max(12px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))]">
      {(title || back || right) && (
        <header className="mb-4 flex min-h-11 items-center gap-2">
          {back && (
            <Link href={back} className="press -ml-2 flex h-11 items-center rounded-pill px-3 text-[17px] font-semibold text-primary">
              ‹ もどる
            </Link>
          )}
          {title && <h1 className="flex-1 truncate text-[24px] font-bold">{title}</h1>}
          {right}
        </header>
      )}
      {store && !store.persistent && (
        <p role="alert" className="mb-3 rounded-lg bg-canvas px-4 py-3 text-[15px] text-wrong ring-1 ring-wrong/30">
          きろくが ほぞんできない せってい です(れんしゅうは できます)
        </p>
      )}
      <main className={`flex flex-1 flex-col ${className}`}>{children}</main>
    </div>
  );
}

export function Loading() {
  return <div className="flex min-h-dvh items-center justify-center text-ink-muted">よみこみちゅう…</div>;
}
