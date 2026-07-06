import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProductTabs } from "./ProductTabs";

const meta: Meta<typeof ProductTabs> = {
  title: "PageSections/ProductTabs",
  component: ProductTabs,
  args: {
    tabs: [
      { id: "description", label: "Description", content: "Whole-herb supplement made from organically grown, sun-dried Moringa leaves." },
      { id: "ingredients", label: "Ingredients", content: "100% Moringa Oleifera leaf powder." },
      { id: "nutrition", label: "Nutrition", content: "Per 100g: Protein 27g, Fiber 19g, Vitamin A 16000IU." },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof ProductTabs>;

export const Default: Story = {};

export const SingleTab: Story = {
  args: { tabs: [{ id: "description", label: "Description", content: "Just one tab." }] },
};
