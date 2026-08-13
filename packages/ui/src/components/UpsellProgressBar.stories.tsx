import type { Meta, StoryObj } from "@storybook/react-vite";
import { UpsellProgressBar } from "./UpsellProgressBar";

const meta: Meta<typeof UpsellProgressBar> = {
  title: "PageSections/UpsellProgressBar",
  component: UpsellProgressBar,
  args: {
    stages: [
      { label: "3% off", triggerType: "ITEM_COUNT", triggerValue: "2", unlocked: true },
      { label: "5% off", triggerType: "ITEM_COUNT", triggerValue: "4", unlocked: false },
      { label: "Free shipping", triggerType: "ORDER_AMOUNT", triggerValue: "3000", unlocked: false },
    ],
    nextStage: { label: "5% off", triggerType: "ITEM_COUNT", remaining: "1" },
  },
};
export default meta;

type Story = StoryObj<typeof UpsellProgressBar>;

export const InProgress: Story = {};

export const AllUnlocked: Story = {
  args: {
    stages: [
      { label: "3% off", triggerType: "ITEM_COUNT", triggerValue: "2", unlocked: true },
      { label: "5% off", triggerType: "ITEM_COUNT", triggerValue: "4", unlocked: true },
    ],
    nextStage: null,
  },
};
