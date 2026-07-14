import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card } from "./Card";

const meta: Meta<typeof Card> = {
  title: "Primitives/Card",
  component: Card,
  decorators: [(Story) => <div style={{ width: 320 }}>{Story()}</div>],
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: { children: <div className="text-sm text-secondary">Card content goes here.</div> },
};
