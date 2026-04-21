/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Amber Sunrise — light values; dark variants handled via useTheme() inline styles
        bg: '#FBF6EE',
        'bg-dark': '#17110A',
        surface: '#FFFFFF',
        'surface-dark': '#221A10',
        surface2: '#F5EEE2',
        'surface2-dark': '#2B2115',
        text: '#2A1F14',
        'text-dark': '#FBF3E3',
        'text-muted': '#6B5A44',
        'text-muted-dark': '#C9B590',
        'text-faint': '#A8957A',
        'text-faint-dark': '#7A6B54',
        hairline: 'rgba(42,31,20,0.08)',
        'hairline-dark': 'rgba(251,243,227,0.10)',
        primary: '#C8621B',
        'primary-dark': '#E89B5C',
        'primary-soft': '#E89B5C',
        accent: '#D89B2B',
        'accent-dark': '#EDBC52',
        water: '#5B9BB8',
        'water-dark': '#7BB6D1',
        'water-soft': '#A8CCDA',
        success: '#5D8A6B',
        'success-dark': '#7CA689',
        danger: '#B15548',
        'danger-dark': '#D37864',

        // Legacy aliases to keep old className usages compiling
        background: '#FBF6EE',
        card: '#FFFFFF',
        'text-primary': '#2A1F14',
      },
      borderRadius: {
        'pill': '9999px',
      },
      fontSize: {
        'eyebrow': ['11px', { letterSpacing: '1px', fontWeight: '700' }],
        'caption': ['12px', { letterSpacing: '0px', fontWeight: '500' }],
        'body': ['15px', { letterSpacing: '-0.2px', fontWeight: '500' }],
        'headline': ['19px', { letterSpacing: '-0.3px', fontWeight: '600' }],
        'title2': ['28px', { letterSpacing: '-0.8px', fontWeight: '700' }],
        'title-large': ['34px', { letterSpacing: '-0.8px', fontWeight: '700' }],
        'timer': ['52px', { letterSpacing: '-2px', fontWeight: '300' }],
      },
    },
  },
  plugins: [],
};
