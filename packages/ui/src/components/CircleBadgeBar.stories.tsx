import type { Meta, StoryObj } from "@storybook/react-vite";
import { CircleBadgeBar } from "./CircleBadgeBar";

const meta: Meta<typeof CircleBadgeBar> = {
  title: "PageSections/CircleBadgeBar",
  component: CircleBadgeBar,
  args: {
    items: Array.from({ length: 6 }).map((_, i) => ({ label: `Category ${i + 1}` })),
  },
};
export default meta;

type Story = StoryObj<typeof CircleBadgeBar>;

export const Default: Story = {};
