"use client";

import { useEffect } from "react";
import Script from "next/script";
import { captureUtmParams } from "@/lib/utm";

export interface PublicAnalyticsConfig {
  ga4: { measurementId: string } | null;
  gtm: { containerId: string } | null;
  meta: { pixelId: string } | null;
  googleAds: { conversionId: string; conversionLabel: string | null } | null;
  tiktok: { pixelCode: string } | null;
  clarity: { projectId: string } | null;
  utmEnabled: boolean;
  customScript: { headerScript: string; bodyScript: string } | null;
}

// Re-parses a raw admin-pasted HTML snippet and re-creates any <script>
// elements via createElement/appendChild — script tags set through
// innerHTML (what dangerouslySetInnerHTML does under the hood) never
// execute, so a literal "<script>...</script>" snippet (the shape every
// tracking vendor hands out) would otherwise silently do nothing.
function injectRawHtml(html: string, target: "head" | "body") {
  const container = document.createElement("div");
  container.innerHTML = html;
  const parent = target === "head" ? document.head : document.body;
  Array.from(container.childNodes).forEach((node) => {
    if (node.nodeName === "SCRIPT") {
      const src = node as HTMLScriptElement;
      const script = document.createElement("script");
      Array.from(src.attributes).forEach((attr) =>
        script.setAttribute(attr.name, attr.value),
      );
      script.text = src.text;
      parent.appendChild(script);
    } else {
      parent.appendChild(node.cloneNode(true));
    }
  });
}

// Injects only the tracking scripts the admin has actually turned on
// (Settings tab under /analytics) — `config` comes from the public
// GET /analytics/config endpoint, fetched server-side in the root layout so
// there's no extra client round trip and no flash of untracked page load.
// Two loading strategies, deliberately:
//
// `afterInteractive` for GA4/Google Ads/GTM. These route through the
// server-side tagging proxy that also drives conversion measurement, so they
// stay on the earlier strategy.
//
// `lazyOnload` for Meta, TikTok and Clarity. Measured on the live homepage,
// these cost 385 ms, 347 ms and ~57 ms of main-thread time respectively
// during the window that decides Total Blocking Time — which is 30% of the
// Lighthouse performance score, and the largest remaining component of it.
// lazyOnload runs them after the load event instead, so they still fire and
// still track; they simply stop competing with rendering.
//
// The trade-off is real and worth knowing before changing it back: a visitor
// who leaves before the load event completes will not be counted. That
// matters most for Meta, since Facebook uses PageView volume to optimise ad
// delivery. If attribution noticeably drops, move `meta` back to
// afterInteractive — it is one word, and the other two can stay lazy.
export function AnalyticsScripts({
  config,
}: {
  config: PublicAnalyticsConfig;
}) {
  useEffect(() => {
    if (config.utmEnabled) captureUtmParams();
  }, [config.utmEnabled]);

  useEffect(() => {
    if (!config.customScript) return;
    // Guards against React StrictMode's double-invoke in dev re-injecting
    // (and thus double-firing) the same third-party script.
    const marker = "__amaderCustomScriptInjected";
    if ((window as unknown as Record<string, boolean>)[marker]) return;
    (window as unknown as Record<string, boolean>)[marker] = true;

    // Deferred to after the load event on purpose — same timing next/script's
    // `lazyOnload` gives the pixels below. This is the ONLY path a tag manager
    // container reaches the page through (the native GA4/Meta/TikTok configs
    // are all null in production), so injecting it during hydration put the
    // container's entire cascade — Meta Pixel, TikTok Pixel, gtag, the unpkg
    // meta-capi param builder — on the main thread exactly when the first taps
    // land. Measured on the live homepage at 4x CPU: TikTok 533 ms, Facebook
    // 360 ms, the container itself 327 ms. That is the INP bill.
    //
    // Same trade-off as the pixels below: a visitor who leaves before load
    // completes is not counted. If attribution drops, the honest fix is fewer
    // tags in the container, not moving this back.
    const inject = () => {
      injectRawHtml(config.customScript!.headerScript, "head");
      if (config.customScript!.bodyScript)
        injectRawHtml(config.customScript!.bodyScript, "body");
    };
    if (document.readyState === "complete") {
      inject();
      return;
    }
    window.addEventListener("load", inject, { once: true });
    return () => window.removeEventListener("load", inject);
  }, [config.customScript]);

  const needsGtag = config.ga4 || config.googleAds;

  return (
    <>
      {needsGtag && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${config.ga4?.measurementId ?? config.googleAds?.conversionId}`}
            strategy="afterInteractive"
          />
          <Script
            id="gtag-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                ${config.ga4 ? `gtag('config', '${config.ga4.measurementId}');` : ""}
                ${config.googleAds ? `gtag('config', '${config.googleAds.conversionId}');` : ""}
              `,
            }}
          />
        </>
      )}

      {config.gtm && (
        <>
          <Script
            id="gtm-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'});
                var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
                j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                })(window,document,'script','dataLayer','${config.gtm.containerId}');
              `,
            }}
          />
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${config.gtm.containerId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        </>
      )}

      {config.meta && (
        <>
          <Script
            id="meta-pixel-init"
            strategy="lazyOnload"
            dangerouslySetInnerHTML={{
              __html: `
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${config.meta.pixelId}');
                fbq('track', 'PageView');
              `,
            }}
          />
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height={1}
              width={1}
              style={{ display: "none" }}
              alt=""
              src={`https://www.facebook.com/tr?id=${config.meta.pixelId}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      )}

      {config.tiktok && (
        <Script
          id="tiktok-pixel-init"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `
              !function (w, d, t) {
                w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<e.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=i+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
                ttq.load('${config.tiktok.pixelCode}');
                ttq.page();
              }(window, document, 'ttq');
            `,
          }}
        />
      )}

      {config.clarity && (
        <Script
          id="clarity-init"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `
              (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "${config.clarity.projectId}");
            `,
          }}
        />
      )}
    </>
  );
}
