"use client";

import { cn } from "../lib/cn";
import { formatMoney } from "./PriceTag";

export interface UpsellProgressBarStage {
  label: string;
  triggerType: "ITEM_COUNT" | "ORDER_AMOUNT";
  triggerValue: string;
  unlocked: boolean;
}

export interface UpsellProgressBarNextStage {
  label: string;
  triggerType: "ITEM_COUNT" | "ORDER_AMOUNT";
  remaining: string;
}

export interface UpsellProgressBarProps {
  stages: UpsellProgressBarStage[];
  nextStage: UpsellProgressBarNextStage | null;
  currentCount?: string | number;
  locale?: string;
  variant?: "standard" | "drawer";
  className?: string;
}

function toBnNum(num: number | string): string {
  const str = String(num);
  const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return str.replace(/\d/g, (d) => bnDigits[Number(d)]);
}

export function UpsellProgressBar({
  stages,
  nextStage,
  currentCount,
  locale = "BN",
  variant = "standard",
  className,
}: UpsellProgressBarProps) {
  if (!stages || stages.length === 0) return null;

  const isBn = locale.toUpperCase() === "BN";
  const unlockedStages = stages.filter((s) => s.unlocked);
  const unlockedCount = unlockedStages.length;
  const totalStages = stages.length;
  const allUnlocked = unlockedCount === totalStages;

  const currentStageIndex = unlockedCount;
  const targetStage = stages[currentStageIndex] ?? stages[stages.length - 1];

  // Compute exact visual progress percentage (0% when cart is empty)
  let pct = 0;
  if (allUnlocked) {
    pct = 100;
  } else if (nextStage) {
    const basePct = (unlockedCount / totalStages) * 100;
    const currentStageTarget = Number(targetStage?.triggerValue || 1);
    const rem = Number(nextStage.remaining || 0);

    const stepProgress = Math.max(0, currentStageTarget - rem);
    const stepPct = (stepProgress / Math.max(1, currentStageTarget)) * (100 / totalStages);

    pct = Math.min(96, Math.max(0, basePct + stepPct));
  }

  const remainingValue = nextStage?.remaining ?? "0";
  const remBn = toBnNum(remainingValue);
  const countDisplay = currentCount ?? unlockedCount;
  const countBn = toBnNum(countDisplay);
  const latestUnlocked = unlockedStages[unlockedStages.length - 1];

  // Drawer variant (compact vertical layout with 2-column grid & bottom banner pill)
  if (variant === "drawer") {
    const drawerTitleNode = nextStage ? (
      isBn ? (
        <>
          আর মাত্র <span className="font-bold text-[#008400]">{nextStage.triggerType === "ORDER_AMOUNT" ? `৳${remBn}` : `${remBn}টি`}</span>{" "}
          {nextStage.triggerType === "ORDER_AMOUNT" ? "টাকা যোগ করুন" : "পণ্য যোগ করুন"}
        </>
      ) : (
        <>
          Add just{" "}
          <span className="font-bold text-[#008400]">
            {nextStage.triggerType === "ORDER_AMOUNT" ? formatMoney(remainingValue) : remainingValue}
          </span>{" "}
          more {nextStage.triggerType === "ORDER_AMOUNT" ? "amount" : "product(s)"}
        </>
      )
    ) : isBn ? (
      "সব অফার সক্রিয় রয়েছে! 🎉"
    ) : (
      "All offers active! 🎉"
    );

    const drawerSubtext = nextStage
      ? isBn
        ? `${nextStage.label} আনলক করুন`
        : `Unlock ${nextStage.label}`
      : isBn
      ? "সকল পুরস্কার অর্ডারে যুক্ত হয়েছে"
      : "All rewards applied to order";

    return (
      <div className={cn("rounded-2xl border border-[#E1F1E5] bg-[#F4FAF5] p-3.5 sm:p-4 shadow-xs", className)}>
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E4F5EB] text-[#008400]">
            <svg className="h-5.5 w-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <h4 className="font-ui text-base font-extrabold text-[#1E293B] leading-tight">
              {drawerTitleNode}
            </h4>
            <p className="mt-0.5 font-body text-xs font-semibold text-[#475569]">
              {drawerSubtext}
            </p>
          </div>
        </div>

        {/* Progress Bar Track */}
        <div className="relative my-3 flex h-2.5 w-full items-center rounded-full bg-[#E2E8F0]">
          <div
            className="h-full rounded-full bg-[#008400] transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />

          {!allUnlocked && pct > 0 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#008400] text-white shadow-xs transition-all duration-500 z-10"
              style={{ left: `${pct}%` }}
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          )}

          <div
            className={cn(
              "absolute right-0 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-xs transition-all z-10",
              allUnlocked ? "border-[#008400] bg-[#008400] text-white" : "border-[#008400] bg-white text-[#008400]"
            )}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V3.5A1.5 1.5 0 0113.5 2h.25A2.25 2.25 0 0116 4.25v.5A2.25 2.25 0 0113.75 7H12zm0 0V3.5A1.5 1.5 0 0010.5 2h-.25A2.25 2.25 0 008 4.25v.5A2.25 2.25 0 0010.25 7H12zM5 11h14M5 11a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2M5 11V7a2 2 0 012-2h10a2 2 0 012 2v4" />
            </svg>
          </div>
        </div>

        {/* 2-Column Middle Grid */}
        <div className="grid grid-cols-2 gap-2 text-center py-2 border-y border-[#E0EFE4] my-2 font-ui text-xs">
          <div className="border-r border-[#E0EFE4] pr-2">
            <span className="block font-medium text-[#64748B]">
              {isBn ? `${countBn}টি পণ্য যোগ হয়েছে` : `${countDisplay} product(s) added`}
            </span>
            <span className="block font-bold text-[#008400] mt-0.5">
              {latestUnlocked?.label ?? (isBn ? "০% ছাড়" : "0% Discount")}
            </span>
          </div>
          <div className="pl-2">
            <span className="block font-medium text-[#64748B]">
              {nextStage
                ? isBn
                  ? `আরও ${remBn}টি বাকি`
                  : `${remainingValue} more to go`
                : isBn
                ? "সব শেষ"
                : "Done"}
            </span>
            <span className="block font-bold text-[#008400] mt-0.5">
              {nextStage?.label ?? (isBn ? "সব আনলকড!" : "All Unlocked!")}
            </span>
          </div>
        </div>

        {/* Bottom Banner Pill */}
        <div className="flex items-center gap-2 rounded-xl bg-[#E8F6ED] px-3 py-2 text-xs font-semibold text-[#008400] mt-2">
          <svg className="h-4 w-4 shrink-0 text-[#008400]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <span className="truncate">
            {nextStage
              ? isBn
                ? `আরও ${remBn}টি পণ্য যোগ করুন, অফারটি পেয়ে যান!`
                : `Add ${remainingValue} more product(s) to get the offer!`
              : isBn
              ? "অভিনন্দন! আপনি সব অফার পেয়ে গেছেন!"
              : "Congrats! You unlocked all offers!"}
          </span>
        </div>
      </div>
    );
  }

  // Standard variant (for Checkout page)
  const titleNode = nextStage ? (
    isBn ? (
      <>
        আর মাত্র <span className="font-bold text-[#008400]">{nextStage.triggerType === "ORDER_AMOUNT" ? `৳${remBn}` : `${remBn}টি`}</span>{" "}
        {nextStage.triggerType === "ORDER_AMOUNT" ? "টাকার কেনাকাটা করুন" : "আইটেম যোগ করুন"}
      </>
    ) : (
      <>
        Add just{" "}
        <span className="font-bold text-[#008400]">
          {nextStage.triggerType === "ORDER_AMOUNT" ? formatMoney(remainingValue) : remainingValue}
        </span>{" "}
        more {nextStage.triggerType === "ORDER_AMOUNT" ? "worth of products" : "item(s)"}
      </>
    )
  ) : isBn ? (
    "অভিনন্দন! আপনি সব পুরস্কার আনলক করেছেন! 🎉"
  ) : (
    "Congratulations! You unlocked all rewards! 🎉"
  );

  // Checkout: one line + a slim bar. The old card (icon, subtitle, pill, two
  // caption rows) said the same thing four times and pushed the form down.
  return (
    <div className={cn("rounded-xl border border-[#E1F1E5] bg-[#F4FAF5] px-4 py-3", className)}>
      <p className="font-ui text-sm font-semibold leading-snug text-[#1E293B]">
        {titleNode}
        {nextStage && <span className="font-bold text-[#008400]"> → {nextStage.label}</span>}
      </p>
      <div className="relative mt-2.5 h-2 w-full rounded-full bg-[#E2E8F0]">
        <div
          className="h-full rounded-full bg-[#008400] transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
        <span
          className={cn(
            "absolute -right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#008400]",
            allUnlocked ? "bg-[#008400] text-white" : "bg-white text-[#008400]",
          )}
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V3.5A1.5 1.5 0 0113.5 2h.25A2.25 2.25 0 0116 4.25v.5A2.25 2.25 0 0113.75 7H12zm0 0V3.5A1.5 1.5 0 0010.5 2h-.25A2.25 2.25 0 008 4.25v.5A2.25 2.25 0 0010.25 7H12zM5 11h14M5 11a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2M5 11V7a2 2 0 012-2h10a2 2 0 012 2v4" />
          </svg>
        </span>
      </div>
    </div>
  );
}
