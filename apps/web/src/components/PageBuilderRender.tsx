import { Render } from "@puckeditor/core/rsc";
import { config } from "@amader/page-builder/config";
import type { Data } from "@puckeditor/core";

/**
 * Renders a stored Puck document on the server.
 *
 * A Server Component with no "use client" anywhere in the chain, so a content
 * page built here ships no extra JavaScript (plan §2.5) and keeps the ISR
 * behaviour of whichever route mounts it.
 *
 * `@puckeditor/core/rsc` rather than the client `<Render>`: the RSC build is
 * the whole reason content pages stay static. Its presence in the installed
 * version was confirmed in Phase 0 (plan §13.2).
 *
 * Deliberately does NOT validate. The caller must check first, because only
 * the caller knows what to do when a document is unrenderable — rendering
 * nothing here would give a blank page where the legacy HTML fallback was
 * wanted.
 */
export function PageBuilderRender({ data }: { data: unknown }) {
  return <Render config={config} data={data as Data} />;
}
