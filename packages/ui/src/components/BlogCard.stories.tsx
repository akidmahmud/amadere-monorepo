import type { Meta, StoryObj } from "@storybook/react-vite";
import { BlogCard } from "./BlogCard";

const meta: Meta<typeof BlogCard> = {
  title: "PageSections/BlogCard",
  component: BlogCard,
  args: {
    post: {
      href: "/blog/five-benefits-of-moringa",
      title: "5 Benefits of Moringa Powder You Didn't Know",
      excerpt: "Moringa has been used for centuries as a natural supplement — here's what modern research says.",
      categoryLabel: "Nutrition",
      authorName: "Dr. Rahman",
      publishedAtLabel: "Jul 1, 2026",
    },
  },
};
export default meta;

type Story = StoryObj<typeof BlogCard>;

export const Default: Story = {};

export const NoImage: Story = {};
