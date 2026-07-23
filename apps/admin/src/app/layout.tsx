import type { Metadata } from "next";
import { Inter, Manrope, Playfair_Display } from "next/font/google";
import { QueryProvider } from "@/components/QueryProvider";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], weight: ["600", "700", "800"], display: "swap" });
// Login page's wordmark only (amader-login.html reference) — not part of the
// dashboard's own type scale.
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], weight: ["600", "700", "800"], display: "swap" });

export const metadata: Metadata = {
  title: "Amader Admin",
};

// AppShell now lives in app/(shell)/layout.tsx instead of here — /login must
// render without the sidebar/topbar chrome, so only the truly global stuff
// (fonts, query client) stays at the root.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable} ${playfair.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
