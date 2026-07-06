import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";
import { CartDrawer } from "./CartDrawer";
import { useCartDrawerStore } from "../stores/cartDrawerStore";

const meta: Meta<typeof CartDrawer> = {
  title: "Layout/CartDrawer",
  component: CartDrawer,
  args: {
    title: "Shopping Cart",
    emptyLabel: "Your cart is empty.",
    checkoutLabel: "Checkout",
    closeLabel: "Close cart",
    subtotalLabel: "Subtotal",
  },
};
export default meta;

type Story = StoryObj<typeof CartDrawer>;

function OpenButton() {
  const open = useCartDrawerStore((s) => s.open);
  return (
    <Button variant="green" onClick={open}>
      Open cart drawer
    </Button>
  );
}

export const Empty: Story = {
  render: (args) => (
    <div>
      <OpenButton />
      <CartDrawer {...args} />
    </div>
  ),
};

export const WithSubtotal: Story = {
  args: { subtotal: "৳1,800.00" },
  render: (args) => (
    <div>
      <OpenButton />
      <CartDrawer {...args} />
    </div>
  ),
};
