// 三角視算表の 1 枚(FR-026)。頂点に積、底辺に 2 つの数。状態は色と線の種類の両方で示す(色だけに頼らない)

import type { CellStatus } from "../engine";

const STYLE: Record<CellStatus, { fill: string; fillOpacity: number; stroke: string; strokeWidth: number; dash?: string; text: string }> = {
  new: { fill: "var(--color-canvas)", fillOpacity: 1, stroke: "var(--color-hairline)", strokeWidth: 3, text: "var(--color-ink-muted)" },
  learning: { fill: "var(--color-primary)", fillOpacity: 0.16, stroke: "var(--color-primary)", strokeWidth: 3, text: "var(--color-ink)" },
  mastered: { fill: "var(--color-primary-fill)", fillOpacity: 1, stroke: "var(--color-primary-fill)", strokeWidth: 3, text: "var(--color-on-primary)" },
  review: { fill: "var(--color-wrong)", fillOpacity: 0.14, stroke: "var(--color-wrong)", strokeWidth: 5, dash: "9 6", text: "var(--color-ink)" },
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
      {highlight && <polygon points="50,1 99,88 1,88" fill="none" stroke="var(--color-correct)" strokeWidth={8} strokeLinejoin="round" className="kuku-glow" />}
      <polygon
        points="50,8 93,84 7,84"
        fill={s.fill}
        fillOpacity={s.fillOpacity}
        stroke={s.stroke}
        strokeWidth={s.strokeWidth}
        strokeDasharray={s.dash}
        strokeLinejoin="round"
      />
      <text x="50" y="52" textAnchor="middle" fontSize="27" fontWeight="700" fill={textFill("top")}>
        {label("top", top)}
      </text>
      <text x="30" y="77" textAnchor="middle" fontSize="21" fontWeight="700" fill={textFill("left")}>
        {label("left", left)}
      </text>
      <text x="70" y="77" textAnchor="middle" fontSize="21" fontWeight="700" fill={textFill("right")}>
        {label("right", right)}
      </text>
    </svg>
  );
}
