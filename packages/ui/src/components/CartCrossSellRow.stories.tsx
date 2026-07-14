import type { Meta, StoryObj } from "@storybook/react-vite";
import { CartCrossSellRow } from "./CartCrossSellRow";

const meta: Meta<typeof CartCrossSellRow> = {
  title: "PageSections/CartCrossSellRow",
  component: CartCrossSellRow,
  args: {
    heading: "Frequently Added Together",
    items: [
      { id: 1, href: "/products/moringa-powder", name: "Organic Moringa Powder", price: "550" },
      { id: 2, href: "/products/honey", name: "Raw Honey 500g", price: "650" },
    ],
    onAdd: () => {},
  },
};
export default meta;

type Story = StoryObj<typeof CartCrossSellRow>;

export const Default: Story = {};
