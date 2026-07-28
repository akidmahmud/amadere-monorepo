import type { Metadata } from "next";
import { QueryProvider } from "@/components/QueryProvider";
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
        {/* Site-wide default type stack (packages/admin-ui's globals.css) —
            Siyam Rupali isn't on Google Fonts, so it's not a next/font call
            like the fonts this replaced; this free/GPL CDN (maateen.me's
            "Bangla Web Fonts" project) is the standard way to embed it. */}
        <link rel="stylesheet" href="https://fonts.maateen.me/siyam-rupali/font.css" precedence="default" />
        {/* Loaded under their real, literal family names — CKEditor5's
            FontFamily feature (a deliberately wider choice than the site's
            own default) writes plain `font-family: "Poppins"` inline styles
            into saved content, which only resolves to the actual typeface
            if a stylesheet registers that exact name. Same list as apps/web's
            layout.tsx (shared via @amader/shared) — see that file for why
            the storefront needs this same link too. */}
        <link rel="stylesheet" href={ckeditorGoogleFontsUrl()} precedence="default" />
      </head>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
