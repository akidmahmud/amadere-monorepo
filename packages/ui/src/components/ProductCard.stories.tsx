import type { Meta, StoryObj } from "@storybook/react-vite";
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
  render: (args) => (
    <div className="w-52">
      <ProductCard
        {...args}
        packOptions={[
          { value: "100g", label: "100g", price: "550.00" },
          { value: "200g", label: "200g", price: "1000.00" },
          { value: "2x100g", label: "100g × 2", price: "1050.00" },
        ]}
      />
    </div>
  ),
};
