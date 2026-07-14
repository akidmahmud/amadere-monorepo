import type { Meta, StoryObj } from "@storybook/react-vite";
import { Header } from "./Header";

const meta: Meta<typeof Header> = {
  title: "Layout/Header",
  component: Header,
  args: {
    brandHref: "/",
    brandMark: "আমাদের",
    searchPlaceholder: "Search",
    searchAriaLabel: "Search",
    trackOrderHref: "/track",
    trackOrderLabel: "Track order",
    accountHref: "/account",
    accountLabel: "My Account",
    cartLabel: "Cart",
    localeSwitchLabel: "বাংলা",
    onLocaleSwitch: () => {},
  },
};
export default meta;

type Story = StoryObj<typeof Header>;

export const Default: Story = {};
export const WithCartCount: Story = { args: { cartCount: 3 } };
