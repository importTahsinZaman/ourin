import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-family)", "system-ui", "sans-serif"],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },
      colors: {
        background: {
          primary: "var(--color-background-primary)",
          secondary: "var(--color-background-secondary)",
          tertiary: "var(--color-background-tertiary)",
          elevated: "var(--color-background-elevated)",
          input: "var(--color-background-input)",
          hover: "var(--color-background-hover)",
          active: "var(--color-background-active)",
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
          inverse: "var(--color-text-inverse)",
          link: "var(--color-text-link)",
          "link-hover": "var(--color-text-link-hover)",
        },
        border: {
          default: "var(--color-border-default)",
          muted: "var(--color-border-muted)",
          focus: "var(--color-border-focus)",
          accent: "var(--color-border-accent)",
        },
        accent: {
          primary: "var(--color-accent-primary)",
          "primary-hover": "var(--color-accent-primary-hover)",
          "primary-muted": "var(--color-accent-primary-muted)",
        },
      },
      borderRadius: {
        sm: "var(--effect-border-radius-sm)",
        md: "var(--effect-border-radius-md)",
        lg: "var(--effect-border-radius-lg)",
        xl: "var(--effect-border-radius-xl)",
      },
      boxShadow: {
        sm: "var(--effect-shadow-sm)",
        md: "var(--effect-shadow-md)",
        lg: "var(--effect-shadow-lg)",
      },
      transitionDuration: {
        fast: "150ms",
        normal: "200ms",
      },
      maxWidth: {
        chat: "var(--layout-chat-max-width)",
      },
      width: {
        sidebar: "var(--layout-sidebar-width)",
        "sidebar-collapsed": "var(--layout-sidebar-collapsed-width)",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
