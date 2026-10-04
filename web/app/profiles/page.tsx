"use client";

// SCR-001 プロフィール選択

import { useRouter } from "next/navigation";
import { useApp } from "@/app-state/AppProvider";
import { MAX_PROFILES } from "@/config";
import { Loading, Screen } from "@/ui/Screen";

export default function ProfilesPage() {
  const { ready, profiles, profile, selectProfile, setEditingProfileId } = useApp();
  const router = useRouter();
  if (!ready) return <Loading />;

  return (
    <Screen title="だれが れんしゅうする?" back={profile ? "/home/" : undefined}>
      <ul className="grid grid-cols-2 gap-4">
        {profiles.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="press flex w-full flex-col items-center gap-2 rounded-lg bg-canvas p-6 ring-1 ring-hairline"
              onClick={async () => {
                await selectProfile(p.id);
                router.push("/home/");
              }}
            >
              <span className="text-[56px] leading-none">{p.icon}</span>
              <span className="w-full truncate text-[20px] font-bold">{p.nickname}</span>
            </button>
          </li>
        ))}
        {profiles.length < MAX_PROFILES && (
          <li>
            <button
              type="button"
              className="press flex h-full min-h-40 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-hairline p-6 text-primary"
              onClick={() => {
                setEditingProfileId(null);
                router.push("/profile-edit/");
              }}
            >
              <span className="text-[40px] leading-none">+</span>
              <span className="text-[20px] font-bold">ついか</span>
            </button>
          </li>
        )}
      </ul>
    </Screen>
  );
}
