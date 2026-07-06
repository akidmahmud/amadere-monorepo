import type { Meta, StoryObj } from "@storybook/react-vite";
import { FilterCheckboxGroup } from "./FilterCheckboxGroup";

const meta: Meta<typeof FilterCheckboxGroup> = {
  title: "PageSections/FilterCheckboxGroup",
  component: FilterCheckboxGroup,
  args: {
    heading: "Category",
    options: [
      { label: "Herbal Supplements", href: "?categoryId=1", active: true, count: 16 },
      { label: "Oils & Ghee", href: "?categoryId=2", active: false, count: 1 },
      { label: "Organic Food", href: "?categoryId=3", active: false, count: 6 },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof FilterCheckboxGroup>;

export const Default: Story = {};

export const NoneActive: Story = {
  args: { options: meta.args!.options!.map((o) => ({ ...o, active: false })) },
};
