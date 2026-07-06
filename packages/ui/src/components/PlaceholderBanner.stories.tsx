import type { Meta, StoryObj } from "@storybook/react-vite";
import { PlaceholderBanner } from "./PlaceholderBanner";

const meta: Meta<typeof PlaceholderBanner> = {
  title: "Composites/PlaceholderBanner",
  component: PlaceholderBanner,
};
export default meta;

type Story = StoryObj<typeof PlaceholderBanner>;

export const Hero: Story = { args: { variant: "hero", dotCount: 8, activeDot: 0 } };
export const Strip: Story = { args: { variant: "strip" } };
export const Tall: Story = { args: { variant: "tall" } };
export const ShopBanner: Story = { args: { variant: "shopban" } };
