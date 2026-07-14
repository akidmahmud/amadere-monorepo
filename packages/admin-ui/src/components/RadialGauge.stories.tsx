import type { Meta, StoryObj } from "@storybook/react-vite";
import { RadialGauge } from "./RadialGauge";

const meta: Meta<typeof RadialGauge> = {
  title: "Primitives/RadialGauge",
  component: RadialGauge,
  args: { progress: 0.6, centerLabel: "12K", caption: "Target vs Achievement" },
};
export default meta;

type Story = StoryObj<typeof RadialGauge>;

export const Default: Story = {};
export const Empty: Story = { args: { progress: 0 } };
export const Full: Story = { args: { progress: 1 } };
