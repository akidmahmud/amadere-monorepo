import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ProductCard } from "./ProductCard";

const meta: Meta<typeof ProductCard> = {
  title: "Composites/ProductCard",
  component: ProductCard,
  args: {
    href: "/products/organic-moringa-powder",
    name: "Organic Moringa Powder",
    price: "550.00",
  },
};
export default meta;

type Story = StoryObj<typeof ProductCard>;

export const Default: Story = {
  render: (args) => (
    <div className="w-52">
      <ProductCard {...args} />
    </div>
  ),
};

export const OnSaleWithBadge: Story = {
  render: (args) => (
    <div className="w-52">
      <ProductCard
        {...args}
        originalPrice="610.00"
        discountLabel="10% OFF"
      />
    </div>
  ),
};

export const WithPackSelector: Story = {
  render: (args) => {
    const [pack, setPack] = useState("100g");
    return (
      <div className="w-52">
        <ProductCard
          {...args}
          packOptions={[
            { value: "100g", label: "100g" },
            { value: "200g", label: "200g" },
            { value: "2x100g", label: "100g × 2" },
          ]}
          selectedPack={pack}
          onPackChange={setPack}
        />
      </div>
    );
  },
};
