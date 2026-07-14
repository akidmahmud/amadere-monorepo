import type { Meta, StoryObj } from "@storybook/react-vite";
import { PaymentCard } from "./PaymentCard";

const meta: Meta<typeof PaymentCard> = {
  title: "Primitives/PaymentCard",
  component: PaymentCard,
  args: { accountType: "Credit Card", maskedNumber: "•••• •••• •••• 2598", balance: "$25000" },
  decorators: [(Story) => <div style={{ width: 300 }}>{Story()}</div>],
};
export default meta;

type Story = StoryObj<typeof PaymentCard>;

export const Default: Story = {};
