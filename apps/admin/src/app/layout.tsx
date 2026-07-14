import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import { QueryProvider } from "@/components/QueryProvider";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], weight: ["600", "700", "800"], display: "swap" });

export const metadata: Metadata = {
  title: "Amader Admin",
};

// AppShell now lives in app/(shell)/layout.tsx instead of here — /login must
// render without the sidebar/topbar chrome, so only the truly global stuff
// (fonts, query client) stays at the root.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
