import type { Meta, StoryObj } from "@storybook/react-vite";
import { NavItem } from "./NavItem";

const gridIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

const meta: Meta<typeof NavItem> = {
  title: "Primitives/NavItem",
  component: NavItem,
  args: { icon: gridIcon, label: "Overview", href: "#" },
  decorators: [(Story) => <div style={{ width: 220, background: "#191919", padding: 12 }}>{Story()}</div>],
};
export default meta;

type Story = StoryObj<typeof NavItem>;

export const Default: Story = {};
export const Active: Story = { args: { active: true } };
