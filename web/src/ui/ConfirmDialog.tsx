"use client";

import { Button } from "./Button";

/** 確認ダイアログ(「やめる」とプロフィール削除のみで使う) */
export function ConfirmDialog({
  message,
  confirmLabel,
  cancelLabel = "つづける",
  danger = false,
  onConfirm,
  onCancel,
}: {
  message: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm(): void;
  onCancel(): void;
}) {
  return (
    // 背面の画面(出題画面の「タップで次へ」等)にクリックを伝えない
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="pop-in w-full max-w-sm rounded-lg bg-canvas p-6 text-center">
        <p className="mb-6 text-[20px] font-bold leading-relaxed">{message}</p>
        <div className="flex flex-col gap-3">
          <Button variant={danger ? "danger" : "secondary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <Button onClick={onCancel}>{cancelLabel}</Button>
        </div>
      </div>
    </div>
  );
}
