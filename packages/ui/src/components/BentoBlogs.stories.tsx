import type { Meta, StoryObj } from "@storybook/react-vite";
import { BentoBlogs } from "./BentoBlogs";

const posts = Array.from({ length: 5 }).map((_, i) => ({
  href: `/blog/post-${i}`,
  title: `Blog post title number ${i + 1}`,
}));

const meta: Meta<typeof BentoBlogs> = {
  title: "PageSections/BentoBlogs",
  component: BentoBlogs,
  args: { posts },
};
export default meta;

type Story = StoryObj<typeof BentoBlogs>;

export const Default: Story = {};
export const Empty: Story = { args: { posts: [] } };
