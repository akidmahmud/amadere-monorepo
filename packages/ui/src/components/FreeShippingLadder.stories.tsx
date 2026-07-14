import type { Meta, StoryObj } from "@storybook/react-vite";
import { FreeShippingLadder } from "./FreeShippingLadder";

const meta: Meta<typeof FreeShippingLadder> = {
  title: "PageSections/FreeShippingLadder",
  component: FreeShippingLadder,
  args: { threshold: "2000", remaining: "450" },
};
export default meta;

type Story = StoryObj<typeof FreeShippingLadder>;

export const InProgress: Story = {};

export const Unlocked: Story = { args: { remaining: "0" } };
