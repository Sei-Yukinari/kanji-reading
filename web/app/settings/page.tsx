"use client";

// SCR-009 設定(FR-010, FR-016, NFR-014, NFR-015)

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { stopPrefetchVoices } from "@/audio/prefetch";
import { VOICE } from "@/audio/voice-config";
import type { Profile } from "@/engine/types";
import { ConfirmDialog } from "@/ui/ConfirmDialog";
import { Loading, Screen } from "@/ui/Screen";
import { useRequireProfile } from "@/ui/useRequireProfile";

export default function SettingsPage() {
  const app = useRequireProfile();
  const router = useRouter();
  const [deleting, setDeleting] = useState<Profile | null>(null);
  if (!app || !app.settings || !app.profile) return <Loading />;
  const { settings, updateSettings, profiles, profile, store, refreshProfiles, setEditingProfileId, selectProfile } = app;

  const remove = async (p: Profile) => {
    if (!store) return;
    await store.deleteProfile(p.id);
    const rest = await refreshProfiles();
    setDeleting(null);
    if (p.id === profile.id) {
      if (rest.length > 0) {
        await selectProfile(rest[0].id);
        router.replace(rest.length > 1 ? "/profiles/" : "/home/");
      } else {
        // 全員消えたら起動からやり直す
        window.location.replace("/");
      }
    }
  };

  return (
    <Screen title="せってい" back="/home/">
      <Section title="おと">
        <Toggle label="こうかおん" checked={settings.sound} onChange={(v) => void updateSettings({ sound: v })} />
        <Toggle
          label="よみあげ"
          checked={settings.voice}
          onChange={(v) => {
            if (!v) stopPrefetchVoices();
            void updateSettings({ voice: v });
          }}
        />
        <p className="px-4 pb-3 text-[15px] text-ink-muted">おとが でないときは、マナーモードや おとの おおきさを かくにんしてね</p>
      </Section>

      <Section title="プロフィール">
        <ul>
          {profiles.map((p) => (
            <li key={p.id} className="flex min-h-14 items-center gap-3 border-b border-hairline px-4 last:border-b-0">
              <span className="text-[28px]">{p.icon}</span>
              <span className="flex-1 truncate text-[18px] font-bold">
                {p.nickname}
                {p.id === profile.id && <span className="ml-2 text-[13px] font-normal text-ink-muted">いま つかっている</span>}
              </span>
              <button
                type="button"
                className="press min-h-11 rounded-pill px-3 text-[17px] font-bold text-primary"
                onClick={() => {
                  setEditingProfileId(p.id);
                  router.push("/profile-edit/");
                }}
              >
                なおす
              </button>
              <button type="button" className="press min-h-11 rounded-pill px-3 text-[17px] font-bold text-wrong" onClick={() => setDeleting(p)}>
                けす
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="きろくの ほぞん">
        <ul className="list-disc space-y-1 px-8 py-3 text-[15px] leading-relaxed">
          <li>きろくは この たんまつの なかだけに ほぞんされます。ほかの たんまつとは きょうゆう されません</li>
          <li>ブラウザの データを けしたり、たんまつを かえたりすると きろくは きえます</li>
          <li>ブラウザによっては、しばらく つかわないと きろくが けされることが あります。ホームがめんに ついかすると きえにくく なります</li>
          {store && !store.persistent && (
            <li className="text-wrong">
              {store.fallbackReason === "broken" ? "きろくを よみこめなかったため、いまは ほぞんできません。アプリを さいしんに すると なおることが あります" : "いまの せっていでは きろくが ほぞんできません"}
            </li>
          )}
        </ul>
        <Link href="/install/" className="press mx-4 mb-4 flex min-h-12 items-center justify-center rounded-pill bg-primary-fill text-[18px] font-bold text-on-primary">
          ホームがめんに ついか
        </Link>
      </Section>

      <Section title="クレジット・ライセンス">
        <ul className="space-y-1 px-4 py-3 text-[14px] leading-relaxed text-ink-muted">
          <li>もんだいの はんい: 小学校学習指導要領(平成29年告示)学年別漢字配当表</li>
          <li>よみあげの こえ: {VOICE.credit}</li>
          <li>
            もんだいの もじ: Klee One(SIL Open Font License 1.1 /{" "}
            <a className="text-primary underline" href="/fonts/KleeOne-OFL.txt">
              ライセンス
            </a>
            )
          </li>
          <li>Next.js / React(MIT)、Tailwind CSS(MIT)、Dexie.js(Apache-2.0)、Serwist(MIT)、fake-indexeddb(Apache-2.0)</li>
          <li>こうかおんは アプリの なかで つくっています</li>
        </ul>
      </Section>

      {deleting && (
        <ConfirmDialog
          message={`「${deleting.nickname}」を けす? きろくも ぜんぶ きえるよ`}
          confirmLabel="けす"
          cancelLabel="やめておく"
          danger
          onConfirm={() => void remove(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 px-1 text-[17px] font-bold text-ink-muted">{title}</h2>
      <div className="overflow-hidden rounded-lg bg-canvas ring-1 ring-hairline">{children}</div>
    </section>
  );
}

function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange(v: boolean): void }) {
  return (
    <label className={`flex min-h-14 items-center justify-between gap-3 border-b border-hairline px-4 ${disabled ? "opacity-45" : ""}`}>
      <span className="text-[18px] font-bold">{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-8 w-14 cursor-pointer appearance-none rounded-pill bg-hairline transition-colors before:block before:size-7 before:translate-x-0.5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:bg-correct checked:before:translate-x-[26px]"
      />
    </label>
  );
}
