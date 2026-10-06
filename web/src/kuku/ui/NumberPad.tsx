"use client";

// 九九の数字キー(FR-030)。2 桁まで入力し「こたえる」で確定する

export const MAX_DIGITS = 2;

export function NumberPad({
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  value: string;
  onChange(v: string): void;
  onSubmit(): void;
  disabled?: boolean;
}) {
  const key = "press flex min-h-14 items-center justify-center rounded-lg bg-canvas text-[28px] font-bold ring-1 ring-hairline disabled:opacity-40 sm:min-h-16";
  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="すうじ キー">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
        <button key={n} type="button" className={key} disabled={disabled || value.length >= MAX_DIGITS} onClick={() => onChange(value + n)}>
          {n}
        </button>
      ))}
      <button type="button" className={`${key} text-[18px]`} disabled={disabled || value === ""} onClick={() => onChange(value.slice(0, -1))}>
        けす
      </button>
      <button type="button" className={key} disabled={disabled || value.length >= MAX_DIGITS || value === ""} onClick={() => onChange(value + 0)}>
        0
      </button>
      <button
        type="button"
        className="press flex min-h-14 items-center justify-center rounded-lg bg-primary-fill text-[18px] font-bold text-on-primary disabled:opacity-40 sm:min-h-16"
        disabled={disabled || value === ""}
        data-testid="submit"
        onClick={onSubmit}
      >
        こたえる
      </button>
    </div>
  );
}
