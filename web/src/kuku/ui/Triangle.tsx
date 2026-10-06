// 三角視算表の 1 マス(FR-026)。どんぐり倶楽部の三角視算表と同じく、長方形のマスに V 字の線を引き、
// V の内側の上に積、左下・右下に 2 つの数を置く。状態は色と線の種類の両方で示す(色だけに頼らない)

import type { CellStatus } from "../engine";

const STYLE: Record<CellStatus, { fill: string; fillOpacity: number; stroke: string; strokeWidth: number; dash?: string; text: string }> = {
  new: { fill: "var(--color-canvas)", fillOpacity: 1, stroke: "var(--color-hairline)", strokeWidth: 3, text: "var(--color-ink-muted)" },
  learning: { fill: "var(--color-primary)", fillOpacity: 0.16, stroke: "var(--color-primary)", strokeWidth: 3, text: "var(--color-ink)" },
  mastered: { fill: "var(--color-primary-fill)", fillOpacity: 1, stroke: "var(--color-primary-fill)", strokeWidth: 3, text: "var(--color-on-primary)" },
  review: { fill: "var(--color-wrong)", fillOpacity: 0.14, stroke: "var(--color-wrong)", strokeWidth: 5, dash: "9 6", text: "var(--color-ink)" },
};

/** マスの V 字の線(マス本体と同じ色。習得済みのように塗りつぶすときは文字色で引く) */
const V_STROKE: Record<CellStatus, string> = {
  new: "var(--color-hairline)",
  learning: "var(--color-primary)",
  mastered: "var(--color-on-primary)",
  review: "var(--color-wrong)",
};

export const STATUS_LABEL: Record<CellStatus, string> = { new: "まだ", learning: "れんしゅうちゅう", mastered: "おぼえた", review: "ふくしゅう" };

export function Triangle({
  top,
  left,
  right,
  status = "new",
  highlight = false,
  hidden,
  className = "",
}: {
  top: number;
  left: number;
  right: number;
  status?: CellStatus;
  /** 回答後・再生中の強調 */
  highlight?: boolean;
  /** 「?」にする場所(出題用) */
  hidden?: "top" | "left" | "right";
  className?: string;
}) {
  const s = STYLE[status];
  const label = (pos: "top" | "left" | "right", n: number) => (hidden === pos ? "?" : String(n));
  const textFill = (pos: "top" | "left" | "right") => (hidden === pos ? "var(--color-primary)" : s.text);
  return (
    <svg viewBox="0 0 100 90" className={className} aria-hidden>
      {highlight && <rect x="1.5" y="1.5" width="97" height="87" rx="8" fill="none" stroke="var(--color-correct)" strokeWidth={6} className="kuku-glow" />}
      <rect
        x="6"
        y="6"
        width="88"
        height="78"
        rx="5"
        fill={s.fill}
        fillOpacity={s.fillOpacity}
        stroke={s.stroke}
        strokeWidth={s.strokeWidth}
        strokeDasharray={s.dash}
      />
      {/* V 字: 上の 2 つの角からマスの下の真ん中へ */}
      <polyline points="8,8 50,82 92,8" fill="none" stroke={V_STROKE[status]} strokeWidth={2.5} strokeLinejoin="round" />
      <text x="50" y="40" textAnchor="middle" fontSize="26" fontWeight="700" fill={textFill("top")}>
        {label("top", top)}
      </text>
      <text x="17" y="78" textAnchor="middle" fontSize="24" fontWeight="700" fill={textFill("left")}>
        {label("left", left)}
      </text>
      <text x="83" y="78" textAnchor="middle" fontSize="24" fontWeight="700" fill={textFill("right")}>
        {label("right", right)}
      </text>
    </svg>
  );
}
