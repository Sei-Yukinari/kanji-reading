"use client";

// 三角視算表の全体図(FR-026, FR-028)。36 組をいつも同じ位置に置く:
// 行 = 小さいほうの数(2〜9)、列 = 大きいほうの数(2〜9)の階段状。1 の段は下に別の列で 9 マス。

import { DANS, TRIANGLES, factsOfOneCell, factsOfTriangle, type KukuFact } from "../data";
import { cellStatus, type CellStatus, type KukuProgress } from "../engine";
import { STATUS_LABEL, Triangle } from "./Triangle";

/** 全体図の 1 マスのキー: 三角は "3-4"、1 の段の列は "1-4"(1×4 と 4×1) */
export const cellKeyOf = (f: KukuFact) => f.triangleId ?? `1-${f.a === 1 ? f.b : f.a}`;

export function factsOfCell(key: string): KukuFact[] {
  const [s, l] = key.split("-").map(Number);
  if (s === 1) return factsOfOneCell(l);
  return factsOfTriangle(TRIANGLES.find((t) => t.id === key)!);
}

export function TriangleChart({
  progress,
  reviewIds,
  highlight,
  onSelect,
  showLegend = true,
}: {
  progress: ReadonlyMap<string, KukuProgress>;
  reviewIds: ReadonlySet<string>;
  /** 強調するマスのキー */
  highlight?: string | null;
  onSelect?(key: string): void;
  showLegend?: boolean;
}) {
  const status = (key: string): CellStatus => cellStatus(factsOfCell(key), progress, reviewIds);
  const cell = (k: string, top: number, left: number, right: number, style?: React.CSSProperties) => {
    const st = status(k);
    const label = `${left} かける ${right} は ${top}。${STATUS_LABEL[st]}`;
    const tri = <Triangle top={top} left={left} right={right} status={st} highlight={highlight === k} className="block w-full" />;
    return onSelect ? (
      <button key={k} type="button" style={style} className="press min-w-0" aria-label={label} data-cell={k} data-status={st} onClick={() => onSelect(k)}>
        {tri}
      </button>
    ) : (
      <div key={k} style={style} className="min-w-0" role="img" aria-label={label} data-cell={k} data-status={st}>
        {tri}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3" data-testid="triangle-chart">
      <div className="grid grid-cols-8 gap-x-0.5 gap-y-1">
        {TRIANGLES.map((t) => cell(t.id, t.product, t.small, t.large, { gridRow: t.small - 1, gridColumn: t.large - 1 }))}
      </div>
      <div>
        <p className="mb-1 text-[13px] font-bold text-ink-muted">1のだん</p>
        <div className="grid grid-cols-9 gap-0.5">
          {DANS.map((n) => cell(`1-${n}`, n, 1, n))}
        </div>
      </div>
      {showLegend && (
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[13px] text-ink-muted">
          {(["new", "learning", "mastered", "review"] as const).map((s) => (
            <li key={s} className="flex items-center gap-1">
              <Triangle top={0} left={0} right={0} status={s} className="size-5 [&_text]:hidden" />
              {STATUS_LABEL[s]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
