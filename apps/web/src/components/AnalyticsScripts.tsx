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
}

// Injects only the tracking scripts the admin has actually turned on
// (Settings tab under /analytics) — `config` comes from the public
// GET /analytics/config endpoint, fetched server-side in the root layout so
// there's no extra client round trip and no flash of untracked page load.
// `strategy="afterInteractive"` per Next.js's own guidance for tag
// managers/analytics (loads after hydration, never blocks first paint).
export function AnalyticsScripts({ config }: { config: PublicAnalyticsConfig }) {
  useEffect(() => {
    if (config.utmEnabled) captureUtmParams();
  }, [config.utmEnabled]);

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
                ${
                  config.googleAds
                    ? `window.__amaderAdsConversion = ${
                        config.googleAds.conversionLabel
                          ? `'${config.googleAds.conversionId}/${config.googleAds.conversionLabel}'`
                          : "null"
                      };`
                    : ""
                }
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
            strategy="afterInteractive"
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
          strategy="afterInteractive"
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
          strategy="afterInteractive"
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
