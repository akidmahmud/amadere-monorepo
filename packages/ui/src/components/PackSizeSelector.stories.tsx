import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { PackSizeSelector } from "./PackSizeSelector";

const options = [
  { value: "100g-x2", label: "100g × 2", price: "1000", originalPrice: "1120", badge: "Best Seller" },
  { value: "100g", label: "100g", price: "550", originalPrice: "610" },
  { value: "200g", label: "200g", price: "1000", originalPrice: "1140" },
];

const meta: Meta<typeof PackSizeSelector> = {
  title: "PageSections/PackSizeSelector",
  component: PackSizeSelector,
};
export default meta;

type Story = StoryObj<typeof PackSizeSelector>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState("100g");
    return <PackSizeSelector options={options} value={value} onChange={setValue} />;
  },
};
