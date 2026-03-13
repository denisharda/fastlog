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
        background: '#0A0A0A',
        surface: '#1A1A1A',
        'text-primary': '#F5F5F5',
        'text-muted': '#9CA3AF',
      },
    },
  },
  plugins: [],
};
