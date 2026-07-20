"use client";

import { useEffect, useRef, useState } from "react";
import { useSocialLogin } from "@/hooks/useAuth";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: { type: "icon" | "standard"; shape?: string; size?: string },
          ) => void;
        };
      };
    };
  }
}

const googleIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22">
    <path fill="#4285F4" d="M22 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.1a4.4 4.4 0 0 1-1.9 2.9v2.4h3.1c1.8-1.7 2.7-4.1 2.7-7.1z" />
    <path fill="#34A853" d="M12 22c2.4 0 4.5-.8 6-2.2l-3.1-2.4c-.8.6-2 .9-2.9.9-2.3 0-4.2-1.5-4.9-3.6H3.9v2.5A9 9 0 0 0 12 22z" />
    <path fill="#FBBC05" d="M7.1 14.7a5.4 5.4 0 0 1 0-3.4V8.8H3.9a9 9 0 0 0 0 8.4z" />
    <path fill="#EA4335" d="M12 7.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 3.9 8.8l3.2 2.5C7.8 9.1 9.7 7.6 12 7.6z" />
  </svg>
);

function FallbackButton({ title }: { title: string }) {
  return (
    <button
      type="button"
      disabled
      title={title}
      className="mx-auto grid h-11 w-11 cursor-not-allowed place-items-center rounded-full border border-line bg-white opacity-50"
    >
      {googleIcon}
    </button>
  );
}

// Renders Google's own circular icon button (via Google Identity Services)
// rather than faking a click on a hidden real button — the officially
// supported way to get a small icon-only Google sign-in trigger. Falls back
// to a plain disabled Google icon if NEXT_PUBLIC_GOOGLE_CLIENT_ID isn't set,
// OR if Google's script loads but fails to actually inject a button (e.g.
// "origin not allowed for client ID" while the OAuth client's authorized
// origins haven't been configured yet) — GSI has no error callback for that,
// so this is detected by checking whether an iframe ever landed in the
// container a moment after asking it to render.
export function GoogleSignInButton({ locale, onSuccess }: { locale: string; onSuccess: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const socialLogin = useSocialLogin(locale);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const [renderFailed, setRenderFailed] = useState(false);

  useEffect(() => {
    if (!clientId || !containerRef.current) return;

    function render() {
      window.google!.accounts.id.initialize({
        client_id: clientId!,
        callback: (response) => {
          socialLogin.mutate({ provider: "GOOGLE", accessToken: response.credential }, { onSuccess });
        },
      });
      window.google!.accounts.id.renderButton(containerRef.current!, {
        type: "icon",
        shape: "circle",
        size: "large",
      });
      setTimeout(() => {
        // GSI can inject an iframe even when the button visually failed (its
        // logo <svg> loses Google's stylesheet and renders at 0x0) — check
        // actual rendered size, not just DOM presence.
        const rect = containerRef.current?.querySelector("svg")?.getBoundingClientRect();
        if (!rect || rect.width === 0 || rect.height === 0) setRenderFailed(true);
      }, 1500);
    }

    if (window.google) {
      render();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = render;
    script.onerror = () => setRenderFailed(true);
    document.head.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (!clientId) return <FallbackButton title="Google sign-in isn't configured yet" />;
  if (renderFailed) return <FallbackButton title="Google sign-in is temporarily unavailable" />;

  return <div ref={containerRef} className="mx-auto grid h-11 w-11 place-items-center" />;
}
