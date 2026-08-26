"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckoutSlot } from "../checkout/slots-context";

/**
 * Lets a pasted HTML page host a real block wherever the author wants it.
 *
 * The author writes a placeholder in their own markup:
 *
 *   <div data-amader-block="CheckoutProductCard"
 *        data-product-slug="fiber-mix"></div>
 *
 * and this portals the real React block into that node after mount. The pasted
 * page keeps its own design and stays server-rendered and indexable; only the
 * block inside it is interactive.
 *
 * A PORTAL rather than string substitution, because the surrounding HTML is
 * injected with dangerouslySetInnerHTML — there is no React tree inside it to
 * mount into. Portalling attaches a real React subtree to a DOM node that
 * already exists, which is exactly the situation here.
 *
 * Deliberately mounts nothing on the server: the placeholder simply stays
 * empty in the served HTML. That keeps the pasted page's own markup the thing
 * crawlers read, and avoids a hydration mismatch against a node React did not
 * render in the first place.
 */

/** `data-product-slug` -> `productSlug`. */
function toProps(el: HTMLElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { name, value } of Array.from(el.attributes)) {
    if (!name.startsWith("data-") || name === "data-amader-block") continue;
    const key = name
      .slice(5)
      .replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
    out[key] = value;
  }
  return out;
}

export function HtmlBlockPortals({ scopeClass }: { scopeClass: string }) {
  const [targets, setTargets] = useState<
    { el: HTMLElement; name: string; props: Record<string, string> }[]
  >([]);

  useEffect(() => {
    const root = document.querySelector(`.${CSS.escape(scopeClass)}`);
    if (!root) return;
    const found = Array.from(
      root.querySelectorAll<HTMLElement>("[data-amader-block]"),
    ).map((el) => ({
      el,
      name: el.getAttribute("data-amader-block") ?? "",
      props: toProps(el),
    }));
    setTargets(found.filter((t) => t.name));
  }, [scopeClass]);

  return (
    <>
      {targets.map(({ el, name, props }, i) =>
        createPortal(<CheckoutSlot name={name} {...props} />, el, `${name}-${i}`),
      )}
    </>
  );
}
