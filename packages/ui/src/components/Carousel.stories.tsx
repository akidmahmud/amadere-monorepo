import type { Meta, StoryObj } from "@storybook/react-vite";
import { Carousel } from "./Carousel";

const meta: Meta<typeof Carousel> = {
  title: "Composites/Carousel",
  component: Carousel,
};
export default meta;

type Story = StoryObj<typeof Carousel>;

export const ProductRow: Story = {
  render: () => (
    <Carousel>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="aspect-square w-[200px] shrink-0 rounded-brand bg-beige"
        />
      ))}
    </Carousel>
  ),
};
