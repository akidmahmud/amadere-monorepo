import type { Meta, StoryObj } from "@storybook/react-vite";
import { Skeleton } from "./Skeleton";

const meta: Meta<typeof Skeleton> = {
  title: "Primitives/Skeleton",
  component: Skeleton,
};
export default meta;

type Story = StoryObj<typeof Skeleton>;

export const Line: Story = { render: () => <Skeleton className="h-4 w-48" /> };
export const CardThumb: Story = { render: () => <Skeleton className="aspect-square w-52" /> };
export const ProductCardShape: Story = {
  render: () => (
    <div className="flex w-52 flex-col gap-2.5 rounded-brand border border-line p-2.5">
      <Skeleton className="aspect-square w-full" />
      <Skeleton className="h-3.5 w-3/4" />
      <Skeleton className="h-4 w-1/2 self-center" />
      <Skeleton className="h-9 w-full" />
    </div>
  ),
};
