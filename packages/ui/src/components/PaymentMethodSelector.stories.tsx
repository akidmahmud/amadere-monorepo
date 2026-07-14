import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { PaymentMethodSelector } from "./PaymentMethodSelector";

const options = [
  { value: "COD", label: "Cash On Delivery" },
  { value: "BKASH", label: "bKash", disabledLabel: "Coming soon" },
  { value: "NAGAD", label: "Nagad", disabledLabel: "Coming soon" },
  { value: "BANK_TRANSFER", label: "Bank Transfer", disabledLabel: "Coming soon" },
];

const meta: Meta<typeof PaymentMethodSelector> = {
  title: "PageSections/PaymentMethodSelector",
  component: PaymentMethodSelector,
};
export default meta;

type Story = StoryObj<typeof PaymentMethodSelector>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState("COD");
    return <PaymentMethodSelector options={options} value={value} onChange={setValue} />;
  },
};
