import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProductCardTwo } from "./ProductCardTwo";

const meta: Meta<typeof ProductCardTwo> = {
  title: "Composites/ProductCardTwo",
  component: ProductCardTwo,
  args: {
    href: "/products/organic-moringa-powder",
    name: "Organic Moringa Powder",
    price: "550.00",
  },
};
export default meta;

type Story = StoryObj<typeof ProductCardTwo>;

export const Default: Story = {
  render: (args) => (
    <div className="w-60">
      <ProductCardTwo {...args} />
    </div>
  ),
};

export const LongTitleStaysOneLine: Story = {
  render: (args) => (
    <div className="w-60">
      <ProductCardTwo
        {...args}
        name="Active Start Combo | Tulsi Lemon Ginger Tea, Shilajit & Moringa Powder Extra Long Name"
      />
    </div>
  ),
};

export const OnSaleWithBadge: Story = {
  render: (args) => (
    <div className="w-60">
      <ProductCardTwo {...args} originalPrice="610.00" flagLabel="Best Selling" />
    </div>
  ),
};

export const SinglePack: Story = {
  render: (args) => (
    <div className="w-60">
      <ProductCardTwo
        {...args}
        packOptions={[{ value: "combo", label: "1 Combo", price: "1657.00", originalPrice: "1883.00" }]}
      />
    </div>
  ),
};

export const MultiplePacks: Story = {
  render: (args) => (
    <div className="w-60">
      <ProductCardTwo
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

export const OutOfStock: Story = {
  render: (args) => (
    <div className="w-60">
      <ProductCardTwo {...args} outOfStock />
    </div>
  ),
};

export const NoImage: Story = {
  render: (args) => (
    <div className="w-60">
      <ProductCardTwo {...args} imageUrl={undefined} />
    </div>
  ),
};
