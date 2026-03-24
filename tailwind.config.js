/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#2D6A4F',
        accent: '#40916C',
        background: '#F2F2F7',
        surface: '#FFFFFF',
        'text-primary': '#1A1A1A',
        'text-muted': '#6B7280',
        water: '#0EA5E9',
        'water-dark': '#0369A1',
        card: '#FFFFFF',
      },
    },
  },
  plugins: [],
};
