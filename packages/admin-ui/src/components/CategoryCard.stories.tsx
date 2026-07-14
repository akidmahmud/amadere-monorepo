import type { Meta, StoryObj } from "@storybook/react-vite";
import { CategoryCard } from "./CategoryCard";

const houseIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path d="M3 11l9-8 9 8M5 10v10h14V10" />
  </svg>
);

const meta: Meta<typeof CategoryCard> = {
  title: "Primitives/CategoryCard",
  component: CategoryCard,
  args: {
    icon: houseIcon,
    name: "Housing",
    amount: "$250.00",
    deltaDirection: "up",
    deltaTone: "danger",
    deltaValue: "15%",
    subrows: [
      { label: "House Rent", amount: "$230.00", date: "17 May 2023" },
      { label: "Parking", amount: "$20.00", date: "17 May 2023" },
    ],
  },
  decorators: [(Story) => <div style={{ width: 320 }}>{Story()}</div>],
};
export default meta;

type Story = StoryObj<typeof CategoryCard>;

export const Default: Story = {};
export const NoSubrows: Story = { args: { subrows: undefined } };
