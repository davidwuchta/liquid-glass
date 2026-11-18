import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

export const metadata: Metadata = {
  title: "Liquid Glass",
  description: "Test to recreate Liquid Glass inside the browser",
};

const interFont = localFont({
  src: "../assets/fonts/inter-variable.ttf",
  variable: "--font-inter",
  display: "swap",
});

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${interFont.variable} ${interFont.className} antialiased bg-black`}
    >
      <body>{children}</body>
    </html>
  );
}
