"use client";

// 存在しない URL はホーム(起動)へ戻す(画面遷移図「例外時の遷移」)

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loading } from "@/ui/Screen";

export default function NotFound() {
  const router = useRouter();
  useEffect(() => router.replace("/"), [router]);
  return <Loading />;
}
