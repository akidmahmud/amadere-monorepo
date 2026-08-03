"use client";

import { useEffect, useState } from "react";

const upIcon = (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

// Reference's own `.to-top` markup has no scroll listener behind it (same
// unwired-placeholder pattern as the product strip's arrows/dots) — this is
// a real, working show-after-scrolling implementation.
export function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setVisible(window.scrollY > 400);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed bottom-[73px] right-[14px] z-[120] grid h-[42px] w-[42px] place-items-center rounded-full border-[1.5px] border-header-green bg-white text-header-green shadow-[0_6px_18px_rgba(30,43,34,.18)] transition-[opacity,visibility,background-color,color] duration-200 hover:bg-header-green hover:text-white md:bottom-[26px] md:right-[22px] md:h-[46px] md:w-[46px] ${
        visible ? "visible opacity-100" : "invisible opacity-0"
      }`}
    >
      {upIcon}
    </button>
  );
}
