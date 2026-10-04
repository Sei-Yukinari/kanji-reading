"use client";

// SCR-010 ホーム画面追加の案内(FR-020, NFR-014)

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/app-state/AppProvider";
import { detectPlatform, type InstallPlatform } from "@/sw/platform";
import { Button } from "@/ui/Button";
import { Loading, Screen } from "@/ui/Screen";

const STEPS: Record<InstallPlatform, { title: string; steps: string[] }> = {
  ios: {
    title: "iPhone・iPad",
    steps: ["したの きょうゆうボタン(□に↑)を おす", "「ホームがめんに ついか」を えらぶ", "みぎうえの「ついか」を おす", "ホームがめんの アイコンから ひらく"],
  },
  android: {
    title: "Android",
    steps: ["みぎうえの「︙」を おす", "「ホームがめんに ついか」または「アプリを インストール」を えらぶ", "「ついか」を おす"],
  },
  desktop: {
    title: "パソコン・Chromebook",
    steps: ["アドレスバーの みぎにある インストールボタンを おす", "「インストール」を おす"],
  },
};

export default function InstallPage() {
  const { ready, profiles, setEditingProfileId } = useApp();
  const router = useRouter();
  const [platform, setPlatform] = useState<InstallPlatform | null>(null);
  useEffect(() => setPlatform(detectPlatform()), []);

  if (!ready || !platform) return <Loading />;
  const first = profiles.length === 0;
  const { title, steps } = STEPS[platform];

  const later = () => {
    if (first) {
      setEditingProfileId(null);
      router.replace("/profile-edit/");
    } else {
      router.back();
    }
  };

  return (
    <Screen title="ホームがめんに ついか" back={first ? undefined : "/home/"}>
      <div className="flex flex-1 flex-col gap-4">
        <p className="rounded-lg bg-canvas p-4 text-[17px] leading-relaxed ring-1 ring-hairline">
          {platform === "ios"
            ? "iPhone・iPad では、ホームがめんに ついかして ひらかないと、きろくが けされることが あります。さきに ついかしてから はじめよう。"
            : "ホームがめんに ついかすると、アプリのように すぐ ひらけて、インターネットが なくても れんしゅう できます。"}
        </p>
        <section className="rounded-lg bg-canvas p-4 ring-1 ring-hairline">
          <h2 className="mb-3 text-[20px] font-bold">{title}の ばあい</h2>
          <ol className="space-y-3">
            {steps.map((s, i) => (
              <li key={s} className="flex items-start gap-3 text-[18px]">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-fill font-bold text-on-primary">{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        </section>
        <div className="mt-auto">
          <Button variant="secondary" className="w-full" onClick={later}>
            {first ? "あとで" : "とじる"}
          </Button>
        </div>
      </div>
    </Screen>
  );
}
