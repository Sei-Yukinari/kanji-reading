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

export function loadGradeData(manifest: Manifest, grade: number): Promise<GradeData> {
  const info = manifest.grades.find((g) => g.grade === grade);
  if (!info) return Promise.reject(new DataLoadError("じゅんびちゅう", "broken"));
  let p = cache.get(info.file);
  if (!p) {
    p = fetchJson<GradeData>(info.file).then((d) => {
      if (d.grade !== grade || !Array.isArray(d.questions)) throw new DataLoadError("もんだいが よみこめませんでした", "broken");
      return d;
    });
    // 失敗したら次回は再取得する
    p.catch(() => cache.delete(info.file));
    cache.set(info.file, p);
  }
  return p;
}
