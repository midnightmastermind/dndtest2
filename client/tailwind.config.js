/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // existing single-value tokens
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        popover: "hsl(var(--popover))",
        "popover-foreground": "hsl(var(--popover-foreground))",
        input: "hsl(var(--border))",
        ring: "hsl(var(--primary))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        muted: "hsl(var(--accent))",
        "muted-foreground": "hsl(var(--accent-foreground))",

        // your custom singles
        overlay: "hsl(var(--overlay))",
        background2: "hsl(var(--background2))",
        input2: "hsl(var(--input2))",

        // ✅ NEW: 3-step variant scales
        backgroundScale: {
          0: "hsl(var(--background-0))",
          1: "hsl(var(--background-1))",
          2: "hsl(var(--background-2))",
        },
        surface: {
          0: "hsl(var(--surface-0))",
          1: "hsl(var(--surface-1))",
          2: "hsl(var(--surface-2))",
        },
        popoverScale: {
          0: "hsl(var(--popover-0))",
          1: "hsl(var(--popover-1))",
          2: "hsl(var(--popover-2))",
        },
        inputScale: {
          0: "hsl(var(--input-0))",
          1: "hsl(var(--input-1))",
          2: "hsl(var(--input-2))",
        },
        overlayScale: {
          0: "hsl(var(--overlay-0))",
          1: "hsl(var(--overlay-1))",
          2: "hsl(var(--overlay-2))",
        },
        borderScale: {
          0: "hsl(var(--border-0))",
          1: "hsl(var(--border-1))",
          2: "hsl(var(--border-2))",
        },
        foregroundScale: {
          0: "hsl(var(--foreground-0))",
          1: "hsl(var(--foreground-1))",
          2: "hsl(var(--foreground-2))",
        },
      },
    },
  },
  plugins: [],
};
