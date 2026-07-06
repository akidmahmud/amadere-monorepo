import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProductGallery } from "./ProductGallery";

const meta: Meta<typeof ProductGallery> = {
  title: "PageSections/ProductGallery",
  component: ProductGallery,
  args: {
    images: [
      { url: "https://picsum.photos/id/1080/600/600", alt: "Front" },
      { url: "https://picsum.photos/id/1081/600/600", alt: "Back" },
      { url: "https://picsum.photos/id/1082/600/600", alt: "Detail" },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof ProductGallery>;

export const Default: Story = {};

export const WithVideo: Story = { args: { videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ" } };

export const SingleImage: Story = { args: { images: [{ url: "https://picsum.photos/id/1080/600/600" }] } };
