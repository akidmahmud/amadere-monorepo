import type { Preview } from "@storybook/react-vite";
import "../src/tokens.css";

// Storybook has no next/font pipeline — load the same four families the app
// uses via next/font/google so components preview with the real typefaces.
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href =
  "https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=Inter:wght@400;500;600&family=Hind+Siliguri:wght@600;700&display=swap";
document.head.appendChild(fontLink);

document.documentElement.style.setProperty("--font-fraunces", "'Fraunces', Georgia, serif");
document.documentElement.style.setProperty("--font-poppins", "'Poppins', sans-serif");
document.documentElement.style.setProperty("--font-inter", "'Inter', sans-serif");
document.documentElement.style.setProperty("--font-hind-siliguri", "'Hind Siliguri', sans-serif");

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "cream",
      values: [
        { name: "cream", value: "#FBF7F1" },
        { name: "white", value: "#FFFFFF" },
      ],
    },
  },
};

export default preview;
