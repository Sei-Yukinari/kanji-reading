import Link from "next/link";
import type { Profile } from "../engine/types";

/** ホーム上部のプロフィール(タップで SCR-001)と設定ボタン(SCR-003, SCR-011) */
export function HomeHeader({ profile }: { profile: Profile }) {
  return (
    <div className="flex w-full items-center justify-between">
      <Link href="/profiles/" className="press flex min-h-11 items-center gap-2 rounded-pill bg-canvas py-1 pr-4 pl-2 ring-1 ring-hairline">
        <span className="text-[28px] leading-none">{profile.icon}</span>
        <span className="max-w-[10em] truncate text-[17px] font-bold">{profile.nickname}</span>
      </Link>
      <Link href="/settings/" aria-label="せってい" className="press flex size-11 items-center justify-center rounded-full bg-canvas text-[22px] ring-1 ring-hairline">
        ⚙️
      </Link>
    </div>
  );
}
