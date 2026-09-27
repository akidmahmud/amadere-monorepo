import type { Metadata } from "next";
import { PosProvider } from "@/components/pos/PosContext";
import { PosRail } from "@/components/pos/PosRail";

export const metadata: Metadata = { title: "POS — Amader" };

// Full-screen, no admin sidebar: the counter screen needs every pixel.
export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div lang="en" className="min-h-screen bg-[#f4f7f5] text-gray-900">
      <PosProvider>
        <div className="flex">
          <PosRail />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </PosProvider>
    </div>
  );
}
