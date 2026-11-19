"use client";

import Link from "next/link";
import React from "react";

interface PillButtonBaseProps {
  children: React.ReactNode;
  theme?: "dark" | "light";
  className?: string;
}

type PillButtonAsButton = PillButtonBaseProps &
  Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    keyof PillButtonBaseProps
  > & {
    href?: undefined;
  };

type PillButtonAsLink = PillButtonBaseProps &
  Omit<React.ComponentProps<typeof Link>, keyof PillButtonBaseProps> & {
    href: string;
  };

export type PillButtonProps = PillButtonAsButton | PillButtonAsLink;

export function Button({
  children,
  theme = "dark",
  className = "",
  ...rest
}: PillButtonProps) {
  const themeStyles =
    theme === "light"
      ? "bg-black/85 text-white hover:bg-black active:bg-black/75"
      : "bg-white/15 text-white border border-white/20 hover:bg-white/25 active:bg-white/10";

  const baseClass = `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-medium tracking-[-0.01em] cursor-pointer select-none transition-colors duration-150 ${themeStyles} ${className}`;

  if ("href" in rest && rest.href !== undefined) {
    const { href, ...linkProps } = rest;
    return (
      <Link href={href} className={baseClass} {...linkProps}>
        {children}
      </Link>
    );
  }

  const { type = "button", ...buttonProps } = rest as Omit<
    PillButtonAsButton,
    keyof PillButtonBaseProps
  >;
  return (
    <button type={type} className={baseClass} {...buttonProps}>
      {children}
    </button>
  );
}
