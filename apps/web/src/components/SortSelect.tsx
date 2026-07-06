"use client";

import { useRouter } from "next/navigation";
import { SORT_OPTIONS, type SortValue } from "@/lib/plp";

export function SortSelect({ value, buildHref }: { value: SortValue; buildHref: (sort: SortValue) => string }) {
  const router = useRouter();

  return (
    <select
      className="cursor-pointer border-none bg-transparent font-serif text-sm text-ink outline-none"
      value={value}
      onChange={(e) => router.push(buildHref(e.target.value as SortValue))}
    >
      {SORT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
