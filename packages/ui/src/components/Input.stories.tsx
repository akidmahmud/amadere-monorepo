import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./Input";

const meta: Meta<typeof Input> = {
  title: "Primitives/Input",
  component: Input,
  args: { placeholder: "Your Full Name *" },
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {};

export const WithLeadingIcon: Story = {
  args: {
    placeholder: "Email or phone",
    leadingIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M4 4h16v16H4z" />
        <path d="m4 6 8 6 8-6" />
      </svg>
    ),
  },
};

export const Password: Story = {
  args: {
    type: "password",
    placeholder: "Password",
    trailingIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
};
