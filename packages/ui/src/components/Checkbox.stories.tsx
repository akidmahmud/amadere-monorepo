import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "./Checkbox";

const meta: Meta<typeof Checkbox> = {
  title: "Primitives/Checkbox",
  component: Checkbox,
};
export default meta;

type Story = StoryObj<typeof Checkbox>;

export const Unchecked: Story = { args: { label: "Herbal Supplements (16)" } };
export const Checked: Story = { args: { label: "Oils & Ghee (1)", defaultChecked: true } };
export const Disabled: Story = { args: { label: "Sugar Alternatives (1)", disabled: true } };
