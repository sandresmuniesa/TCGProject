/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ink: "#101420",
        mist: "#f4f7fb",
        accent: "#e63946",
        gold: "#f4b942",
        steel: "#54728c"
      }
    }
  },
  plugins: []
};