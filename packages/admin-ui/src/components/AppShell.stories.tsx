import type { Meta, StoryObj } from "@storybook/react-vite";
import { AppShell, type AppNavItem } from "./AppShell";
import { StatCard } from "./StatCard";

const gridIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);
const boxIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 10h18" />
  </svg>
);

const nav: AppNavItem[] = [
  { key: "overview", label: "Overview", href: "#overview", icon: gridIcon },
  { key: "orders", label: "Orders", href: "#orders", icon: boxIcon },
];

const meta: Meta<typeof AppShell> = {
  title: "Primitives/AppShell",
  component: AppShell,
  args: {
    logo: (
      <>
        <b>Amader</b> Admin
      </>
    ),
    nav,
    activeHref: "#overview",
    userName: "Tanzir Rahman",
    pageTitle: "Hello Tanzir",
    dateLabel: "May 19, 2023",
    hasNotification: true,
    children: (
      <div className="grid grid-cols-3 gap-6">
        <StatCard label="Goals" value="$20,000" />
        <StatCard label="Total Balance" value="$240,399" />
      </div>
    ),
  },
};
export default meta;

type Story = StoryObj<typeof AppShell>;

export const Default: Story = {
  parameters: { layout: "fullscreen" },
};
