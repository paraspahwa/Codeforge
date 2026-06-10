/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "../../packages/ui/src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        cfbg: "var(--cf-bg)",
        cfsurface: "var(--cf-surface)",
        cftext: "var(--cf-text)",
        cfmuted: "var(--cf-muted)",
        cfprimary: "var(--cf-primary)",
        cfaccent: "var(--cf-accent)",
        cfsuccess: "var(--cf-success)",
        cfwarning: "var(--cf-warning)",
        cfdanger: "var(--cf-danger)",
      },
      borderRadius: {
        cf: "var(--cf-radius-md)",
        "cf-lg": "var(--cf-radius-lg)",
      },
      fontFamily: {
        sans: ["var(--cf-font-sans)"],
        mono: ["var(--cf-font-mono)"],
      },
      boxShadow: {
        glow: "var(--cf-shadow-glow)",
      },
    },
  },
  plugins: [],
};
