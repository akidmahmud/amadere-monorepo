import type { Meta, StoryObj } from "@storybook/react-vite";
import { DeltaBadge } from "./DeltaBadge";

const meta: Meta<typeof DeltaBadge> = {
  title: "Primitives/DeltaBadge",
  component: DeltaBadge,
};
export default meta;

type Story = StoryObj<typeof DeltaBadge>;

export const BadIncrease: Story = { args: { direction: "up", tone: "danger", value: "15%" } };
export const GoodDecrease: Story = { args: { direction: "down", tone: "success", value: "08%" } };
