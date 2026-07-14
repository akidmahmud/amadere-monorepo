import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconTile } from "./IconTile";

const boxIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
  </svg>
);

const meta: Meta<typeof IconTile> = {
  title: "Primitives/IconTile",
  component: IconTile,
  args: { children: boxIcon },
};
export default meta;

type Story = StoryObj<typeof IconTile>;

export const Default: Story = {};
