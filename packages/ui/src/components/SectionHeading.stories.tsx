import type { Meta, StoryObj } from "@storybook/react-vite";
import { SectionHeading, ViewAllLink } from "./SectionHeading";

const meta: Meta<typeof SectionHeading> = {
  title: "Composites/SectionHeading",
  component: SectionHeading,
  args: { children: "Our Best Sellers" },
};
export default meta;

type Story = StoryObj<typeof SectionHeading>;

export const Default: Story = {};

export const WithViewAll: Story = {
  render: (args) => (
    <div>
      <SectionHeading {...args} />
      <ViewAllLink href="/products" />
    </div>
  ),
};
