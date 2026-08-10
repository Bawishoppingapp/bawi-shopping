/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "../../packages/mobile-ui/src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset"), require("@bawi/mobile-ui/tailwind-preset")],
  theme: {
    extend: {},
  },
  plugins: [],
};
