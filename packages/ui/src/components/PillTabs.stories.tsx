import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { PillTabs } from "./PillTabs";

const options = [
  { value: "immunity", label: "Immunity" },
  { value: "digestion", label: "Digestion" },
  { value: "diabetes", label: "Diabetes Care" },
  { value: "skin", label: "Skin & Hair" },
];

const meta: Meta<typeof PillTabs> = {
  title: "Composites/PillTabs",
  component: PillTabs,
};
export default meta;

type Story = StoryObj<typeof PillTabs>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState("immunity");
    return <PillTabs options={options} value={value} onChange={setValue} />;
  },
};
