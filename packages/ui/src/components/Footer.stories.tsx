import type { Meta, StoryObj } from "@storybook/react-vite";
import { Footer } from "./Footer";

const meta: Meta<typeof Footer> = {
  title: "Layout/Footer",
  component: Footer,
  args: {
    brandMark: "আমাদের",
    description:
      "আমাদের™ is dedicated to bringing pure, natural food from trusted farms to every home in Bangladesh.",
    address: "Dhaka, Bangladesh",
    phone: "+880 1234 567890",
    email: "support@amadere.com",
    facebookHref: "#",
    instagramHref: "#",
    youtubeHref: "#",
    googlePlayHref: "#",
    appStoreHref: "#",
    appDownloadLabel: "Download App on Mobile:",
    columns: [
      {
        heading: "Information",
        links: [
          { label: "About Us", href: "/about" },
          { label: "Blog", href: "/blog" },
          { label: "Terms & Conditions", href: "/terms" },
          { label: "Privacy Policy", href: "/privacy" },
        ],
      },
      {
        heading: "Shop By",
        links: [
          { label: "Amader Oil", href: "/categories/amader-oil" },
          { label: "Amader Modhu", href: "/categories/amader-modhu" },
        ],
      },
      {
        heading: "Support",
        links: [
          { label: "Support Center", href: "/support" },
          { label: "FAQ", href: "/faq" },
        ],
      },
      {
        heading: "Consumer Policy",
        links: [
          { label: "Happy Return", href: "/happy-return" },
          { label: "Refund Policy", href: "/refund-policy" },
        ],
      },
    ],
    copyrightLabel: "Copyright © 2026 Amader Ltd. All rights reserved.",
    payWithLabel: "Pay With",
    sslBadgeLine1: "Verified by",
    sslBadgeLine2: "SSLCOMMERZ",
  },
};
export default meta;

type Story = StoryObj<typeof Footer>;

export const Default: Story = {};
