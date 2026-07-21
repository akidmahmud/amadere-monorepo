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

// Renders Google's own circular icon button (via Google Identity Services)
// rather than faking a click on a hidden real button — the officially
// supported way to get a small icon-only Google sign-in trigger. Renders
// nothing if NEXT_PUBLIC_GOOGLE_CLIENT_ID isn't set, OR if Google's script
// loads but fails to actually inject a button (e.g. "origin not allowed for
// client ID" while the OAuth client's authorized origins haven't been
// configured yet) — GSI has no error callback for that, so this is detected
// by checking whether an iframe ever landed in the container a moment after
// asking it to render.
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

  if (!clientId || renderFailed) return null;

  return (
    <>
      <div className="mx-auto mb-4 flex max-w-[280px] items-center gap-3 font-body text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        or sign in with
        <span className="h-px flex-1 bg-line" />
      </div>
      <div ref={containerRef} className="mx-auto grid h-11 w-11 place-items-center" />
    </>
  );
}
