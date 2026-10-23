import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT } from "./data-io";

// 本番のセキュリティヘッダー(NFR-009)。E2E は vercel.json のヘッダーなしで配信するため、ここで確認する
type HeaderRule = { source: string; headers: { key: string; value: string }[] };
const rules = (JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8")) as { headers: HeaderRule[] }).headers;
const header = (key: string) => rules.find((r) => r.source === "/(.*)")!.headers.find((h) => h.key === key)?.value;

describe("vercel.json のセキュリティヘッダー", () => {
  it("マイクは九九の音声入力(FR-031)のため自サイトだけ許可し、カメラ・位置情報は無効のまま", () => {
    const policy = Object.fromEntries(header("Permissions-Policy")!.split(",").map((d) => d.trim().split("=") as [string, string]));
    expect(policy.microphone).toBe("(self)");
    expect(policy.camera).toBe("()");
    expect(policy.geolocation).toBe("()");
  });
});
