import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs } from "./Tabs";

const meta: Meta<typeof Tabs> = {
  title: "Primitives/Tabs",
  component: Tabs,
};
export default meta;

type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState("all");
    return (
      <Tabs
        value={value}
        onChange={setValue}
        options={[
          { value: "all", label: "All" },
          { value: "revenue", label: "Revenue" },
          { value: "expenses", label: "Expenses" },
        ]}
      />
    );
  },
};
