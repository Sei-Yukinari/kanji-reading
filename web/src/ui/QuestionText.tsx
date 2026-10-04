import type { Highlight, Ruby } from "../data/types";

/** 問題文の描画。未習漢字はルビ(FR-022)、出題範囲は下線と強調 */
export function QuestionText({ prompt, ruby, highlight, underline }: { prompt: string; ruby: Ruby[]; highlight: Highlight; underline: boolean }) {
  const chars = [...prompt];
  const nodes: React.ReactNode[] = [];
  const isHl = (i: number) => i >= highlight.start && i < highlight.start + highlight.length;
  let i = 0;
  while (i < chars.length) {
    const r = ruby.find((x) => x.start === i);
    const len = r ? r.length : 1;
    const text = chars.slice(i, i + len).join("");
    const node = r ? (
      <ruby key={i}>
        {text}
        <rt className="text-[0.35em] font-normal">{r.kana}</rt>
      </ruby>
    ) : (
      text
    );
    nodes.push(
      isHl(i) && underline ? (
        <span key={i} data-testid="highlight" className="font-bold text-primary underline decoration-[0.08em] underline-offset-[0.18em]">
          {node}
        </span>
      ) : (
        <span key={i}>{node}</span>
      ),
    );
    i += len;
  }
  return <>{nodes}</>;
}
