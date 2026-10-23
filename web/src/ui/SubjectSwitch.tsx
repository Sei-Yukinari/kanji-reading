"use client";

// 科目の切り替え(FR-025)。SCR-003 ホームと SCR-011 九九ホームの上部に置く

import Link from "next/link";

export type Subject = "kanji" | "kuku";

const ITEMS: { subject: Subject; href: string; label: string }[] = [
  { subject: "kanji", href: "/home/", label: "かんじ" },
  { subject: "kuku", href: "/kuku/", label: "くく" },
];

export function SubjectSwitch({ current }: { current: Subject }) {
  return (
    <nav aria-label="かもく" className="mb-4 grid grid-cols-2 gap-1 rounded-pill bg-canvas p-1 ring-1 ring-hairline">
      {ITEMS.map((i) => {
        const selected = i.subject === current;
        return (
          <Link
            key={i.subject}
            href={i.href}
            aria-current={selected ? "page" : undefined}
            className={`press flex min-h-11 items-center justify-center rounded-pill text-[18px] font-bold ${selected ? "bg-primary-fill text-on-primary" : "text-ink"}`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
