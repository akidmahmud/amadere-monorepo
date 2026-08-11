import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { QtyStepper } from "./QtyStepper";

const meta: Meta<typeof QtyStepper> = {
  title: "Composites/QtyStepper",
  component: QtyStepper,
};
export default meta;

type Story = StoryObj<typeof QtyStepper>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState(1);
    return <QtyStepper value={value} onChange={setValue} />;
  },
};

export const AtMax: Story = {
  args: { value: 5, max: 5, onChange: () => {} },
};
