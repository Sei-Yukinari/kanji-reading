"use client";

// 画面間で共有する状態(プロフィール・学年・問題データ・出題設定・結果)

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { SoundPlayer } from "../audio/sound";
import { DataLoadError, loadGradeData, loadManifest } from "../data/loader";
import type { GradeData, Manifest } from "../data/types";
import type { AnswerRecord, Mode, Profile, QuizItem, SessionRecord, Settings } from "../engine/types";
import { openStore, type LearningStore } from "../store/db";

export interface QuizConfig {
  mode: Mode;
  grade: number;
  unitId?: string;
}

export interface QuizResult {
  config: QuizConfig;
  items: QuizItem[];
  answers: AnswerRecord[];
  session: SessionRecord;
  newMedals: string[];
  previousBestMs?: number;
  /** 記録の保存に失敗した */
  saveFailed: boolean;
}

interface AppContextValue {
  ready: boolean;
  store: LearningStore | null;
  manifest: Manifest | null;
  manifestError: string | null;
  profiles: Profile[];
  profile: Profile | null;
  settings: Settings | null;
  sound: SoundPlayer;
  refreshProfiles(): Promise<Profile[]>;
  selectProfile(id: string): Promise<void>;
  setGrade(grade: number): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  loadGrade(grade: number): Promise<GradeData>;
  quizConfig: QuizConfig | null;
  setQuizConfig(c: QuizConfig | null): void;
  result: QuizResult | null;
  setResult(r: QuizResult | null): void;
  /** SCR-002 で編集するプロフィール(null は新規作成) */
  editingProfileId: string | null;
  setEditingProfileId(id: string | null): void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [store, setStore] = useState<LearningStore | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [quizConfig, setQuizConfig] = useState<QuizConfig | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const soundRef = useRef<SoundPlayer>(null);
  soundRef.current ??= new SoundPlayer();
  const sound = soundRef.current;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await openStore();
      let m: Manifest | null = null;
      try {
        m = await loadManifest();
        await s.purgeRemovedQuestions(m.removedQuestionIds);
      } catch (e) {
        if (!cancelled) setManifestError(e instanceof DataLoadError ? e.message : "もんだいが よみこめませんでした");
      }
      const ps = await s.listProfiles();
      const lastId = await s.getMeta<string>("lastProfileId");
      // 前回のプロフィール、または 1 件しかなければそれを選ぶ(画面遷移図「起動」)
      const initial = ps.find((p) => p.id === lastId) ?? (ps.length === 1 ? ps[0] : null);
      const st = initial ? await s.getSettings(initial.id) : null;
      if (cancelled) return;
      setStore(s);
      setManifest(m);
      setProfiles(ps);
      setProfile(initial);
      setSettings(st);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // オフライン動作のための Service Worker(本番ビルドのみ生成される。FR-019)
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("Service Worker の登録に失敗しました", e));
  }, []);

  useEffect(() => {
    sound.enabled = settings?.sound ?? true;
    sound.voiceEnabled = settings?.voice ?? true;
  }, [settings, sound]);

  // 最初のタップで AudioContext をアンロックする(iOS の自動再生制限)
  useEffect(() => {
    const unlock = () => sound.unlock();
    window.addEventListener("pointerdown", unlock, { capture: true });
    return () => window.removeEventListener("pointerdown", unlock, { capture: true });
  }, [sound]);

  const refreshProfiles = useCallback(async () => {
    if (!store) return [];
    const ps = await store.listProfiles();
    setProfiles(ps);
    setProfile((cur) => (cur ? (ps.find((p) => p.id === cur.id) ?? null) : cur));
    return ps;
  }, [store]);

  const selectProfile = useCallback(
    async (id: string) => {
      if (!store) return;
      const p = await store.getProfile(id);
      if (!p) return;
      await store.setMeta("lastProfileId", id);
      setProfile(p);
      setSettings(await store.getSettings(id));
    },
    [store],
  );

  const setGrade = useCallback(
    async (grade: number) => {
      if (!store || !profile) return;
      const next = { ...profile, lastGrade: grade };
      await store.saveProfile(next);
      setProfile(next);
      setProfiles((ps) => ps.map((p) => (p.id === next.id ? next : p)));
    },
    [store, profile],
  );

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      if (!store || !settings) return;
      const next = { ...settings, ...patch };
      await store.saveSettings(next);
      setSettings(next);
    },
    [store, settings],
  );

  const loadGrade = useCallback(
    (grade: number) => (manifest ? loadGradeData(manifest, grade) : Promise.reject(new DataLoadError("インターネットに つないでね", "offline"))),
    [manifest],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      ready, store, manifest, manifestError, profiles, profile, settings, sound,
      refreshProfiles, selectProfile, setGrade, updateSettings, loadGrade,
      quizConfig, setQuizConfig, result, setResult, editingProfileId, setEditingProfileId,
    }),
    [ready, store, manifest, manifestError, profiles, profile, settings, sound, refreshProfiles, selectProfile, setGrade, updateSettings, loadGrade, quizConfig, result, editingProfileId],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const v = useContext(AppContext);
  if (!v) throw new Error("AppProvider の外で useApp が呼ばれました");
  return v;
}
