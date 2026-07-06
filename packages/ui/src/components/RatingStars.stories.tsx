import type { Meta, StoryObj } from "@storybook/react-vite";
import { RatingStars } from "./RatingStars";

const meta: Meta<typeof RatingStars> = {
  title: "Composites/RatingStars",
  component: RatingStars,
};
export default meta;

type Story = StoryObj<typeof RatingStars>;

export const FourPointFive: Story = { args: { rating: 4.5, count: 128 } };
export const Empty: Story = { args: { rating: 0 } };
export const Perfect: Story = { args: { rating: 5, count: 12 } };
