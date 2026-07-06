import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ProductCarouselSection } from "./ProductCarouselSection";

const products = Array.from({ length: 6 }).map((_, i) => ({
  href: `/products/item-${i}`,
  name: `Organic Product ${i + 1}`,
  price: "550.00",
}));

const meta: Meta<typeof ProductCarouselSection> = {
  title: "PageSections/ProductCarouselSection",
  component: ProductCarouselSection,
  args: {
    heading: "Our Best Sellers",
    products,
    viewAllHref: "/products",
    viewAllLabel: "View All",
  },
};
export default meta;

type Story = StoryObj<typeof ProductCarouselSection>;

export const Default: Story = {};

export const WithPills: Story = {
  render: (args) => {
    const [pill, setPill] = useState("immunity");
    return (
      <ProductCarouselSection
        {...args}
        pillOptions={[
          { value: "immunity", label: "Immunity" },
          { value: "digestion", label: "Digestion" },
        ]}
        activePill={pill}
        onPillChange={setPill}
      />
    );
  },
};

export const Empty: Story = { args: { products: [] } };
