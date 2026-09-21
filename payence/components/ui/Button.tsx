import type { ReactNode, ButtonHTMLAttributes } from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "invert";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-pill font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-45";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-canvas hover:bg-ink/90",
  secondary: "border border-hairStrong bg-surface text-ink hover:border-ink",
  ghost: "text-ink hover:bg-shell",
  danger: "bg-danger text-white hover:bg-danger/90",
  invert: "bg-canvas text-ink hover:bg-coral hover:text-canvas",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px]",
  md: "h-11 px-5 text-[14px]",
  // 52px: a comfortable one-handed target on a phone.
  lg: "h-[52px] px-7 text-[15px]",
};

type Props = {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  href?: string;
  className?: string;
  full?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">;

export function Button({ children, variant = "primary", size = "md", href, className = "", full, ...rest }: Props) {
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${full ? "w-full" : ""} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}
