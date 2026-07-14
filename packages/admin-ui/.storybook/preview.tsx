import type { Preview } from "@storybook/react-vite";
import "../src/globals.css";

// Storybook has no next/font pipeline — load the same two families the admin
// app uses via Google Fonts so components preview with the real typefaces.
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap";
document.head.appendChild(fontLink);

document.documentElement.style.setProperty("--font-inter", "'Inter', -apple-system, 'Segoe UI', system-ui, sans-serif");
document.documentElement.style.setProperty("--font-manrope", "'Manrope', sans-serif");

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "app-bg",
      values: [
        { name: "app-bg", value: "#F4F5F7" },
        { name: "surface", value: "#FFFFFF" },
        { name: "dark", value: "#0E0E0E" },
      ],
    },
  },
  globalTypes: {
    theme: {
      description: "Theme",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: ["light", "dark"],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      document.documentElement.setAttribute("data-theme", context.globals.theme === "dark" ? "dark" : "light");
      return Story();
    },
  ],
};

export default preview;
