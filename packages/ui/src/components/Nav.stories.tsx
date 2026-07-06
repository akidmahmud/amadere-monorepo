import type { Meta, StoryObj } from "@storybook/react-vite";
import { Nav } from "./Nav";

const items = [
  { key: "all", label: "All Products", href: "/products" },
  { key: "category", label: "Shop By Category", href: "/categories", hasChildren: true },
  { key: "condition", label: "Shop By Condition", href: "/health-concerns", hasChildren: true },
  { key: "combos", label: "Super Saver Combos", href: "/combos" },
  { key: "goal", label: "Shop By Goal", href: "/goals" },
];

const meta: Meta<typeof Nav> = {
  title: "Layout/Nav",
  component: Nav,
  args: { items, activeHref: "/products" },
};
export default meta;

type Story = StoryObj<typeof Nav>;

export const Default: Story = {};
