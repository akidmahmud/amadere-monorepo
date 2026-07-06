import type { Meta, StoryObj } from "@storybook/react-vite";
import { CategoryCard } from "./CategoryCard";

const meta: Meta<typeof CategoryCard> = {
  title: "PageSections/CategoryCard",
  component: CategoryCard,
  args: { href: "/categories/herbal-supplements", name: "Herbal Supplements" },
};
export default meta;

type Story = StoryObj<typeof CategoryCard>;

export const Default: Story = {};
