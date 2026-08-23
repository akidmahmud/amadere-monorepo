"use client";

// The site's social-network glyph set, keyed by the icon names in
// packages/shared/src/footer.ts (FOOTER_SOCIAL_ICONS). Lifted out of
// Footer.tsx when the PDP's Author tab needed the same icons — an author's
// social links are picked from the same admin-managed list, so there is one
// glyph map, not two that drift.
//
// 16px throughout: both consumers render these inside a 40px circle.

const facebookIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
    <path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.3 0-1.1-.1-2-.1-2 0-3.4 1.2-3.4 3.5V11H8.5v3H11v7Z" />
  </svg>
);

const instagramIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const youtubeIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
    <path d="m10 15 5-3-5-3z" fill="currentColor" stroke="none" />
  </svg>
);

const tiktokIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
    <path d="M16.5 3c.3 2 1.8 3.5 3.8 3.8v2.7c-1.4 0-2.7-.4-3.8-1.2v6.2c0 3.1-2.5 5.5-5.6 5.5S5.3 17.6 5.3 14.5 7.8 9 10.9 9c.3 0 .6 0 .9.1v2.8a2.8 2.8 0 1 0 2 2.7V3Z" />
  </svg>
);

const whatsappIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20Zm4.4-5.9c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.6.1s-.7.8-.8.9-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.6-1.2.1-.2 0-.3 0-.5s-.6-1.5-.9-2c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.2-.9.9-.9 2.2s1 2.6 1.1 2.8c.1.2 2 3 4.8 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1-.1-.1-.2-.2-.4-.3Z" />
  </svg>
);

const linkedinIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
    <path d="M4.5 3.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM3 9h3v11H3Zm6 0h2.9v1.5h.1c.4-.8 1.5-1.7 3.1-1.7 3.3 0 3.9 2.2 3.9 5V20h-3v-4.8c0-1.1 0-2.6-1.6-2.6s-1.9 1.3-1.9 2.5V20H9Z" />
  </svg>
);

const xIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
    <path d="M4 3h4.4l4 5.4L17 3h3l-6.2 7.9L21 21h-4.4l-4.4-5.9L6.7 21H3.6l6.7-8.5Z" />
  </svg>
);

const telegramIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
    <path d="M21 4 3 11.4c-.7.3-.7 1.3.1 1.5l4.4 1.4 1.7 5.3c.2.6 1 .8 1.4.3l2.4-2.6 4.5 3.4c.6.4 1.4.1 1.6-.6l3-16c.1-.7-.6-1.3-1.3-1.1Zm-3.3 3.6-6.9 6.3-.4 3.1-1.4-4.3 8.2-5.5c.2-.1.4.1.2.3Z" />
  </svg>
);

const pinterestIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
    <path d="M12 2a10 10 0 0 0-3.6 19.3c0-.8 0-1.8.2-2.6l1.4-6s-.3-.7-.3-1.7c0-1.6.9-2.8 2.1-2.8 1 0 1.5.7 1.5 1.6 0 1-.6 2.4-.9 3.8-.3 1.1.6 2.1 1.7 2.1 2.1 0 3.5-2.6 3.5-5.8 0-2.4-1.6-4.2-4.6-4.2-3.3 0-5.4 2.5-5.4 5.2 0 1 .3 1.6.7 2.1.2.2.2.3.1.6l-.3 1c-.1.3-.3.4-.6.3-1.6-.7-2.4-2.5-2.4-4.5 0-3.4 2.8-7.4 8.4-7.4 4.5 0 7.4 3.2 7.4 6.7 0 4.6-2.6 8-6.3 8-1.3 0-2.4-.7-2.8-1.4l-.8 3c-.2.9-.7 1.9-1.1 2.6A10 10 0 1 0 12 2Z" />
  </svg>
);

// Neutral globe/link glyph shown when an icon lookup fails to produce
// anything: a `custom` icon/style with no `imageUrl` (e.g. the Media row it
// pointed at was deleted) or a name absent from SOCIAL_ICONS/APP_ICONS.
// Without this, `SOCIAL_ICONS[item.icon] ?? null` renders an empty bordered
// circle — present, but visibly broken. Two sizes so it matches whichever
// row it renders in: the 40px social circle uses the other built-in
// glyphs' 16px size, the app-button row uses their 20px size.
export const socialFallbackIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
  </svg>
);

export const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  facebook: facebookIcon,
  instagram: instagramIcon,
  youtube: youtubeIcon,
  tiktok: tiktokIcon,
  whatsapp: whatsappIcon,
  linkedin: linkedinIcon,
  x: xIcon,
  telegram: telegramIcon,
  pinterest: pinterestIcon,
};
