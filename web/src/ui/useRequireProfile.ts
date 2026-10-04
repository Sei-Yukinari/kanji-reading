"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "../app-state/AppProvider";

/** プロフィール未選択でアクセスされたら起動画面へ戻す */
export function useRequireProfile() {
  const app = useApp();
  const router = useRouter();
  useEffect(() => {
    if (app.ready && !app.profile) router.replace("/");
  }, [app.ready, app.profile, router]);
  return app.ready && app.profile ? app : null;
}
