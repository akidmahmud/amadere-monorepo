import type { Meta, StoryObj } from "@storybook/react-vite";
import { Container } from "./Container";

const meta: Meta<typeof Container> = {
  title: "Layout/Container",
  component: Container,
};
export default meta;

type Story = StoryObj<typeof Container>;

export const Default: Story = {
  render: () => (
    <Container className="bg-beige py-4">
      <p className="font-body text-sm text-ink">Max width 1180px, centered.</p>
    </Container>
  ),
};
