"use client";

// 起動時の振り分け(docs/design/05-screen-flow.mdx「起動」)

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "@/app-state/AppProvider";
import { isIOSBrowserTab } from "@/sw/platform";
import { Loading } from "@/ui/Screen";

export default function LaunchPage() {
  const { ready, profile, profiles, setEditingProfileId } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (profile) {
      router.replace("/home/");
    } else if (profiles.length === 0) {
      setEditingProfileId(null);
      // iOS の Safari タブはホーム画面アプリとストレージが分かれるため、先に案内する(FR-017)
      router.replace(isIOSBrowserTab() ? "/install/" : "/profile-edit/");
    } else {
      router.replace("/profiles/");
    }
  }, [ready, profile, profiles, router, setEditingProfileId]);

  return <Loading />;
}
