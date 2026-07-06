import type { Meta, StoryObj } from "@storybook/react-vite";
import { PriceTag } from "./PriceTag";

const meta: Meta<typeof PriceTag> = {
  title: "Composites/PriceTag",
  component: PriceTag,
};
export default meta;

type Story = StoryObj<typeof PriceTag>;

export const Regular: Story = { args: { price: "1000.00" } };
export const OnSale: Story = { args: { price: "550.00", originalPrice: "610.00" } };
export const Large: Story = { args: { price: "1800.00", size: "lg" } };
