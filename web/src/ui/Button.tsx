import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

const VARIANT: Record<Variant, string> = {
  primary: "bg-primary-fill text-on-primary",
  secondary: "bg-canvas text-primary ring-1 ring-hairline",
  danger: "bg-canvas text-wrong ring-1 ring-hairline",
};

/** ピル型ボタン(高さ 56px・文字 20px 以上。NFR-005, NFR-007) */
export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`press min-h-14 rounded-pill px-6 text-[20px] font-bold disabled:opacity-40 ${VARIANT[variant]} ${className}`}
    />
  );
}
