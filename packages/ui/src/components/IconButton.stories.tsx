import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconButton } from "./IconButton";

const cart = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
  </svg>
);
const chevronRight = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
const trash = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
  </svg>
);

const meta: Meta<typeof IconButton> = {
  title: "Primitives/IconButton",
  component: IconButton,
};
export default meta;

type Story = StoryObj<typeof IconButton>;

export const Ghost: Story = { args: { variant: "ghost", "aria-label": "Cart", children: cart } };
export const GoldRound: Story = {
  args: { variant: "gold-round", "aria-label": "Next", children: chevronRight },
};
export const Danger: Story = {
  args: { variant: "danger", "aria-label": "Remove item", children: trash },
};
