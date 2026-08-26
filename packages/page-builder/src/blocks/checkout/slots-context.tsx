"use client";

import { CHECKOUT_BLOCK_LABELS } from "../../block-names";
import {
  createContext,
  useContext,
  type ComponentType,
  type ReactNode,
} from "react";

/**
 * The client half of the checkout slot plumbing.
 *
 * Split out of index.tsx deliberately. When the whole block module carried
 * "use client", its exported `checkoutBlocks` object became a client reference,
 * and the server renderer could not read the `render` functions off it — so
 * every checkout block on a server-rendered page was **silently dropped**. No
 * error, no placeholder, just absent markup, which is the hardest kind of
 * failure to notice.
 *
 * The contrast that gave it away: `SandboxedHtml` is also a client component
 * and renders fine, because the module that *defines the block* around it is a
 * server module. Only the leaf needs to be client.
 */

export type CheckoutSlotProps = Record<string, unknown>;
export type CheckoutSlotComponent = ComponentType<CheckoutSlotProps>;

/** name -> component. Whatever an app does not supply renders as missing. */
export type CheckoutSlotMap = Partial<Record<string, CheckoutSlotComponent>>;

const SlotsContext = createContext<CheckoutSlotMap | null>(null);

export function CheckoutSlotsProvider({
  slots,
  children,
}: {
  slots: CheckoutSlotMap;
  children: ReactNode;
}) {
  return <SlotsContext.Provider value={slots}>{children}</SlotsContext.Provider>;
}

export function CheckoutSlot({
  name,
  ...props
}: { name: string } & CheckoutSlotProps) {
  const slots = useContext(SlotsContext);
  const Impl = slots?.[name];

  if (!Impl) {
    // Visible rather than silent. A missing implementation means the layout is
    // being drawn somewhere that does not know how to render this block — the
    // author needs to see that, not discover it on the live page.
    //
    // In practice the place this shows up is the ADMIN BUILDER CANVAS, which
    // deliberately supplies no slot map: the real card needs the cart, payment
    // config and order mutation, none of which belong in the editor. It used
    // to print the bare block name ("CheckoutProductCard"), which reads like a
    // rendering bug rather than a preview — so it now says what it is and what
    // will happen when the page is published.
    const label = CHECKOUT_BLOCK_LABELS[name] ?? name;
    return (
      <div className="rounded-brand border border-dashed border-line bg-beige p-4 text-center font-body text-sm text-muted">
        <span className="block font-semibold text-ink">{label}</span>
        <span className="mt-1 block text-xs">
          Preview only — the live order form appears on the published page.
        </span>
      </div>
    );
  }
  return <Impl {...props} />;
}
