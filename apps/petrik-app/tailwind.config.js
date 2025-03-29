/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        gradiant1: "#076653",
        gradiant2: "#06231D",
        primary: "#E3EF26",
      },
    },
  },
  plugins: [],
}