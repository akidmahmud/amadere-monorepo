import type { Meta, StoryObj } from "@storybook/react-vite";
import { CertificationRow } from "./CertificationRow";

const meta: Meta<typeof CertificationRow> = {
  title: "PageSections/CertificationRow",
  component: CertificationRow,
};
export default meta;

type Story = StoryObj<typeof CertificationRow>;

export const Default: Story = {};
