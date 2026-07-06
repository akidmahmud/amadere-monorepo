import type { Meta, StoryObj } from "@storybook/react-vite";
import { FeatureTileRow } from "./FeatureTile";

const meta: Meta<typeof FeatureTileRow> = {
  title: "PageSections/FeatureTileRow",
  component: FeatureTileRow,
};
export default meta;

type Story = StoryObj<typeof FeatureTileRow>;

export const Default: Story = {};
