import type { Meta, StoryObj } from "@storybook/react-vite";
import { Select } from "./Select";

const packOptions = [
  { value: "100g", label: "100g — ৳550" },
  { value: "200g", label: "200g — ৳1,000" },
  { value: "2x100g", label: "100g × 2 — ৳1,000" },
];

const sortOptions = [
  { value: "best", label: "Best Selling" },
  { value: "low", label: "Price: Low to High" },
  { value: "high", label: "Price: High to Low" },
  { value: "new", label: "Newest" },
];

const meta: Meta<typeof Select> = {
  title: "Primitives/Select",
  component: Select,
};
export default meta;

type Story = StoryObj<typeof Select>;

export const Bordered: Story = {
  args: { options: packOptions, defaultValue: "100g", "aria-label": "Pack size" },
};

export const Plain: Story = {
  args: {
    options: sortOptions,
    defaultValue: "best",
    variant: "plain",
    "aria-label": "Sort by",
  },
};
