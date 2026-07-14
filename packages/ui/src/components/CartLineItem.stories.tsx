import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { CartLineItem } from "./CartLineItem";

const meta: Meta<typeof CartLineItem> = {
  title: "PageSections/CartLineItem",
  component: CartLineItem,
};
export default meta;

type Story = StoryObj<typeof CartLineItem>;

export const Default: Story = {
  render: () => {
    const [qty, setQty] = useState(2);
    return (
      <CartLineItem
        item={{
          id: 1,
          href: "/products/gawa-ghee",
          name: "Gawa Ghee 1kg",
          variantLabel: "1kg",
          quantity: qty,
          unitPrice: "1800",
          lineTotal: String(1800 * qty),
        }}
        onQuantityChange={setQty}
        onRemove={() => {}}
      />
    );
  },
};
