import type { Meta, StoryObj } from "@storybook/react-vite";
import { Pager } from "./Pager";

const meta: Meta<typeof Pager> = {
  title: "PageSections/Pager",
  component: Pager,
  args: {
    page: 3,
    totalPages: 8,
    buildHref: (page: number) => `/products?page=${page}`,
  },
};
export default meta;

type Story = StoryObj<typeof Pager>;

export const Default: Story = {};

export const FirstPage: Story = { args: { page: 1 } };

export const LastPage: Story = { args: { page: 8 } };

export const SinglePage: Story = { args: { page: 1, totalPages: 1 } };
