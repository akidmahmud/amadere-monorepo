import type { Meta, StoryObj } from "@storybook/react-vite";
import { Footer } from "./Footer";

const meta: Meta<typeof Footer> = {
  title: "Layout/Footer",
  component: Footer,
  args: {
    brandMark: "আমাদের",
    newsletterHeading: "Subscribe to our newsletter",
    newsletterPlaceholder: "Your email address",
    subscribeLabel: "Subscribe",
    columns: [
      {
        heading: "About",
        links: [
          { label: "About Us", href: "/about" },
          { label: "Blog", href: "/blog" },
          { label: "Certifications", href: "/certifications" },
        ],
      },
      {
        heading: "Help",
        links: [
          { label: "FAQs", href: "/faqs" },
          { label: "Terms & Conditions", href: "/terms" },
          { label: "Privacy Policy", href: "/privacy" },
        ],
      },
    ],
    contact: "Dhaka, Bangladesh\nhello@amadere.com\n+880 1234 567890",
    rightsLabel: "© 2026 Amader. All rights reserved.",
  },
};
export default meta;

type Story = StoryObj<typeof Footer>;

export const Default: Story = {};
