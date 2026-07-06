import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  title: "Primitives/Button",
  component: Button,
  args: { children: "Add to Cart" },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Green: Story = { args: { variant: "green" } };
export const Gold: Story = { args: { variant: "gold", children: "Place Order" } };
export const Ghost: Story = { args: { variant: "ghost" } };
export const Large: Story = { args: { variant: "gold", size: "lg" } };
export const Block: Story = { args: { block: true } };
export const Disabled: Story = { args: { disabled: true } };
