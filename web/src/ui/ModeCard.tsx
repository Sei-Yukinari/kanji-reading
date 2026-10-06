/** ホームのモード選択カード(SCR-003, SCR-011) */
export function ModeCard({
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
