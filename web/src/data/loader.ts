// 問題データの取得(API-001 / API-002)。取得後はメモリに保持する(NFR-001)

import { SUPPORTED_SCHEMA_VERSION } from "../config";
import type { GradeData, Manifest } from "./types";

export class DataLoadError extends Error {
  constructor(
    message: string,
    readonly kind: "offline" | "broken",
  ) {
    super(message);
  }
}

const cache = new Map<string, Promise<GradeData>>();

async function fetchJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new DataLoadError("インターネットに つないでね", "offline");
  }
  if (!res.ok) throw new DataLoadError("もんだいが よみこめませんでした", "broken");
  try {
    return (await res.json()) as T;
  } catch {
    throw new DataLoadError("もんだいが よみこめませんでした", "broken");
  }
}

export async function loadManifest(): Promise<Manifest> {
  const m = await fetchJson<Manifest>("/data/manifest.json");
  if (m.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    throw new DataLoadError("もんだいが よみこめませんでした", "broken");
  }
  return m;
}

async function fetchGrade(file: string, grade: number): Promise<GradeData> {
  const d = await fetchJson<GradeData>(file);
  if (d.grade !== grade || !Array.isArray(d.questions)) throw new DataLoadError("もんだいが よみこめませんでした", "broken");
  return d;
}

export function loadGradeData(manifest: Manifest, grade: number): Promise<GradeData> {
  const info = manifest.grades.find((g) => g.grade === grade);
  if (!info) return Promise.reject(new DataLoadError("じゅんびちゅう", "broken"));
  let p = cache.get(info.file);
  if (!p) {
    p = fetchGrade(info.file, grade).catch(async (e: unknown) => {
      // 配信更新の直後は、起動時に読んだ manifest が指すファイル名(ハッシュ)が存在しないことがある。
      // manifest を取り直して 1 回だけ再試行する(機能設計「キャッシュを破棄して再取得」)
      if (!(e instanceof DataLoadError) || e.kind !== "broken") throw e;
      const fresh = await loadManifest();
      const latest = fresh.grades.find((g) => g.grade === grade);
      if (!latest || latest.file === info.file) throw e;
      return fetchGrade(latest.file, grade);
    });
    // 失敗したら次回は再取得する
    p.catch(() => cache.delete(info.file));
    cache.set(info.file, p);
  }
  return p;
}
