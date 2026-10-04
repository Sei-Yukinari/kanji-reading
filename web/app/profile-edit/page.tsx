"use client";

// SCR-002 プロフィール作成・編集(FR-016, FR-018)

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/app-state/AppProvider";
import { MAX_PROFILES, NICKNAME_MAX } from "@/config";
import { Button } from "@/ui/Button";
import { PROFILE_ICONS } from "@/ui/icons";
import { Loading, Screen } from "@/ui/Screen";

export default function ProfileEditPage() {
  const app = useApp();
  if (!app.ready || !app.store) return <Loading />;
  const editing = app.profiles.find((p) => p.id === app.editingProfileId) ?? null;
  return <ProfileForm key={editing?.id ?? "new"} editingId={editing?.id ?? null} />;
}

function ProfileForm({ editingId }: { editingId: string | null }) {
  const { store, profiles, profile, refreshProfiles, selectProfile } = useApp();
  const router = useRouter();
  const editing = profiles.find((p) => p.id === editingId) ?? null;
  const [nickname, setNickname] = useState(editing?.nickname ?? "");
  const [icon, setIcon] = useState<string>(editing?.icon ?? PROFILE_ICONS[0]);
  const [saving, setSaving] = useState(false);

  const trimmed = nickname.trim();
  const length = [...trimmed].length;
  const valid = length >= 1 && length <= NICKNAME_MAX;
  const isFirst = profiles.length === 0;
  const full = !editing && profiles.length >= MAX_PROFILES;

  const save = async () => {
    if (!store || !valid || saving || full) return;
    setSaving(true);
    const id = editing?.id ?? crypto.randomUUID();
    await store.saveProfile({
      id,
      nickname: trimmed,
      icon,
      createdAt: editing?.createdAt ?? Date.now(),
      lastGrade: editing?.lastGrade ?? 1,
    });
    await refreshProfiles();
    if (editing) {
      router.back();
    } else {
      await selectProfile(id);
      router.replace("/home/");
    }
  };

  return (
    <Screen
      title={editing ? "プロフィールを なおす" : isFirst ? "ようこそ!" : "プロフィールを つくる"}
      back={isFirst ? undefined : editing ? "/settings/" : profile ? "/home/" : "/profiles/"}
    >
      <form
        className="flex flex-1 flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="flex flex-col gap-2">
          <span className="text-[20px] font-bold">ニックネーム</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={NICKNAME_MAX * 2}
            autoComplete="off"
            enterKeyHint="done"
            placeholder="れい: たろう"
            className="min-h-14 rounded-lg bg-canvas px-4 text-[22px] ring-1 ring-hairline focus:ring-2 focus:ring-primary focus:outline-none"
          />
          <span className={`text-[15px] ${trimmed && !valid ? "text-wrong" : "text-ink-muted"}`}>
            {trimmed && !valid ? `1〜${NICKNAME_MAX}もじで いれてね` : "なまえ でなくても だいじょうぶ"}
          </span>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[20px] font-bold">アイコン</legend>
          <div className="grid grid-cols-6 gap-2">
            {PROFILE_ICONS.map((ic) => (
              <button
                key={ic}
                type="button"
                aria-label={`アイコン ${ic}`}
                aria-pressed={icon === ic}
                onClick={() => setIcon(ic)}
                className={`press flex aspect-square min-h-11 items-center justify-center rounded-lg bg-canvas text-[32px] ${icon === ic ? "ring-3 ring-primary" : "ring-1 ring-hairline"}`}
              >
                {ic}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-auto">
          {full && <p className="mb-2 text-center text-wrong">プロフィールは {MAX_PROFILES}にん までです</p>}
          <Button type="submit" className="w-full" disabled={!valid || saving || full}>
            {editing ? "ほぞん" : "はじめる"}
          </Button>
        </div>
      </form>
    </Screen>
  );
}
