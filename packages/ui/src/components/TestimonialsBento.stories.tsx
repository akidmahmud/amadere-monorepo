import type { Meta, StoryObj } from "@storybook/react-vite";
import { TestimonialsBento } from "./TestimonialsBento";

const meta: Meta<typeof TestimonialsBento> = {
  title: "PageSections/TestimonialsBento",
  component: TestimonialsBento,
  args: {
    reviews: [
      { quote: "This ghee is the best I have ever had — my father loves it.", name: "Shahriar Khan Abir", role: "Service Holder" },
      { quote: "একদম সন্তুষ্ট! দারুণ কোয়ালিটি আর দ্রুত ডেলিভারি।", name: "Ayesha Khan", role: "Banker" },
      { quote: "Thanks for the free honey — great as a regular customer.", name: "Sultana Yesmin", role: "Housewife", rating: 4 },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof TestimonialsBento>;

export const Default: Story = {};

export const Empty: Story = {
  args: { reviews: [] },
};
