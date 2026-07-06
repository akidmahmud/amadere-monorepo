import type { Meta, StoryObj } from "@storybook/react-vite";
import { TestimonialsBento } from "./TestimonialsBento";

const meta: Meta<typeof TestimonialsBento> = {
  title: "PageSections/TestimonialsBento",
  component: TestimonialsBento,
};
export default meta;

type Story = StoryObj<typeof TestimonialsBento>;

export const Default: Story = {};
