import type { Meta, StoryObj } from "@storybook/react-vite";
import { BarChart } from "./BarChart";

const meta: Meta<typeof BarChart> = {
  title: "Primitives/BarChart",
  component: BarChart,
  args: {
    title: "Weekly Comparison",
    currentLabel: "This week",
    compareLabel: "Last week",
    data: [
      { label: "17 Sun", current: 120, compare: 80 },
      { label: "18 Mon", current: 60, compare: 40 },
      { label: "19 Tue", current: 55, compare: 35 },
      { label: "20 Wed", current: 95, compare: 60 },
      { label: "21 Thu", current: 70, compare: 45 },
      { label: "22 Fri", current: 150, compare: 90 },
      { label: "23 Sat", current: 130, compare: 85 },
    ],
  },
  decorators: [(Story) => <div style={{ width: 480 }}>{Story()}</div>],
};
export default meta;

type Story = StoryObj<typeof BarChart>;

export const Default: Story = {};
