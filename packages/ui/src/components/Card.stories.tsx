import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card } from "./Card";

const meta: Meta<typeof Card> = {
  title: "Primitives/Card",
  component: Card,
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: (args) => (
    <Card {...args} className="w-64 p-4">
      <p className="font-body text-sm text-ink">Card content goes here.</p>
    </Card>
  ),
};

export const HoverLift: Story = {
  render: (args) => (
    <Card {...args} hoverLift className="w-64 p-4">
      <p className="font-body text-sm text-ink">Hover to see the lift.</p>
    </Card>
  ),
};
