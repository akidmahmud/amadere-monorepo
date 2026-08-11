import type { Metadata } from "next";
import { QueryProvider } from "@/components/QueryProvider";
import { ToastProvider } from "@/components/ToastProvider";
import { ckeditorGoogleFontsUrl } from "@amader/shared";
import "./globals.css";

export const metadata: Metadata = {
  title: "Amader Admin",
};

// AppShell now lives in app/(shell)/layout.tsx instead of here — /login must
// render without the sidebar/topbar chrome, so only the truly global stuff
// (fonts, query client) stays at the root.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          precedence="default"
        />
        {/* Loaded under their real, literal family names — this is also how
            the site-wide default type stack (packages/admin-ui's
            globals.css: Open Sans + Noto Sans Bengali) actually gets its
            typefaces, since both happen to already be in this same list;
            no separate link needed for them. CKEditor5's FontFamily feature
            (a deliberately wider choice beyond the site's own default)
            writes plain `font-family: "Poppins"` inline styles into saved
            content, which only resolves to the actual typeface if a
            stylesheet registers that exact name. Same list as apps/web's
            layout.tsx (shared via @amader/shared) — see that file for why
            the storefront needs this same link too. */}
        <link rel="stylesheet" href={ckeditorGoogleFontsUrl()} precedence="default" />
      </head>
      <body>
        <QueryProvider>
          <ToastProvider>{children}</ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
