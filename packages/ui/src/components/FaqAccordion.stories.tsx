import type { Meta, StoryObj } from "@storybook/react-vite";
import { FaqAccordion } from "./FaqAccordion";

const meta: Meta<typeof FaqAccordion> = {
  title: "PageSections/FaqAccordion",
  component: FaqAccordion,
  args: {
    items: [
      { question: "How should Moringa powder be stored?", answer: "Keep in a cool, dry place away from direct sunlight, sealed tightly after each use." },
      { question: "Is this suitable for daily use?", answer: "Yes — 1 teaspoon daily is the recommended serving for most adults." },
      { question: "Does it contain any additives?", answer: "No, it's 100% pure Moringa Oleifera leaf powder with nothing else added." },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof FaqAccordion>;

export const Default: Story = {};
