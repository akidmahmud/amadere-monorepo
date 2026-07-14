import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatCard } from "./StatCard";
import { PaymentCard } from "./PaymentCard";

const meta: Meta<typeof StatCard> = {
  title: "Primitives/StatCard",
  component: StatCard,
  decorators: [(Story) => <div style={{ width: 320 }}>{Story()}</div>],
};
export default meta;

type Story = StoryObj<typeof StatCard>;

export const Simple: Story = { args: { label: "Goals", value: "$20,000" } };
export const WithPaymentCard: Story = {
  args: {
    label: "Total Balance",
    value: "$240,399",
    children: <PaymentCard accountType="Credit Card" maskedNumber="•••• •••• •••• 2598" balance="$25000" />,
  },
};
