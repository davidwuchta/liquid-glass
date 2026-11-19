import Link from "next/link";
import { ReactNode } from "react";

interface LinkButtonProps {
  href: string;
  children: ReactNode;
  className?: string;
}

export default function Button({
  href,
  children,
  className = "",
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={`absolute top-5 left-5 flex items-center justify-center bg-white rounded-full px-5 py-2 font-bold hover:bg-gray-300 transition-colors ${className}`}
    >
      {children}
    </Link>
  );
}
