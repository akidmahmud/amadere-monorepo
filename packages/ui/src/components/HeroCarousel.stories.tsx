import type { Meta, StoryObj } from "@storybook/react-vite";
import { HeroCarousel } from "./HeroCarousel";

const meta: Meta<typeof HeroCarousel> = {
  title: "PageSections/HeroCarousel",
  component: HeroCarousel,
};
export default meta;

type Story = StoryObj<typeof HeroCarousel>;

export const Default: Story = {};
