import type { Meta, StoryObj } from "@storybook/react-vite";
import { ListRow } from "./ListRow";

const tileIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <circle cx="12" cy="12" r="8" />
  </svg>
);

const meta: Meta<typeof ListRow> = {
  title: "Primitives/ListRow",
  component: ListRow,
  args: {
    icon: tileIcon,
    title: "Polo Shirt",
    subtitle: "XL fashions",
    amount: "$20.00",
    meta: "17 May 2023",
  },
  decorators: [(Story) => <div style={{ width: 360 }}>{Story()}</div>],
};
export default meta;

type Story = StoryObj<typeof ListRow>;

export const Default: Story = {};
