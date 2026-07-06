import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "./Badge";

const meta: Meta<typeof Badge> = {
  title: "Primitives/Badge",
  component: Badge,
  args: { children: "10% OFF" },
};
export default meta;

type Story = StoryObj<typeof Badge>;

export const Gold: Story = { args: { variant: "gold" } };
export const Green: Story = { args: { variant: "green", children: "Best Seller" } };
export const Delete: Story = { args: { variant: "delete", children: "Out of Stock" } };
