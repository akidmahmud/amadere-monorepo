import type { Meta, StoryObj } from "@storybook/react-vite";
import { Nav } from "./Nav";

const items = [
  {
    key: "category",
    label: "Shop By Category",
    href: "/categories",
    children: [
      { key: "herbs", label: "Amader Herbs", href: "/categories/amader-herbs" },
      { key: "oil", label: "Amader Oil", href: "/categories/amader-oil" },
    ],
  },
  { key: "combos", label: "Super Saver Combos", href: "/combos" },
  { key: "goal", label: "Shop By Goal", href: "/goals" },
];

const meta: Meta<typeof Nav> = {
  title: "Layout/Nav",
  component: Nav,
  args: { allProductsHref: "/products", allProductsLabel: "All Products", items, activeHref: "/products" },
};
export default meta;

type Story = StoryObj<typeof Nav>;

export const Default: Story = {};
