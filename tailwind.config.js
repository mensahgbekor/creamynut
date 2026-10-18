/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cocoa: {
          50: '#faf6f0',
          100: '#f0e6d8',
          200: '#e0ccb0',
          300: '#c9a882',
          400: '#b08356',
          500: '#9a6a3f',
          600: '#7c5a3a',
          700: '#63482f',
          800: '#4a3524',
          900: '#33241a',
          950: '#221810',
        },
        peanut: {
          50: '#fdf8ec',
          100: '#f9edd0',
          200: '#f2d89e',
          300: '#eabd66',
          400: '#e3a33d',
          500: '#d98a24',
          600: '#c26f1c',
          700: '#a1541b',
          800: '#83421c',
          900: '#6c371a',
        },
        gold: {
          300: '#f7d774',
          400: '#f0c04a',
          500: '#e3a92c',
          600: '#c98a1e',
        },
        cream: {
          50: '#fdfaf4',
          100: '#f8f1e4',
          200: '#efe3cd',
        },
        leaf: {
          400: '#7fb069',
          500: '#5f9e4a',
          600: '#4a7f39',
        },
        chili: {
          500: '#d9411e',
          600: '#b93317',
        },
      },
      fontFamily: {
        display: ['"Baloo 2"', 'cursive'],
        sans: ['"Nunito Sans"', 'sans-serif'],
      },
      boxShadow: {
        warm: '0 10px 40px -12px rgba(51, 36, 26, 0.25)',
        'warm-lg': '0 20px 60px -15px rgba(51, 36, 26, 0.3)',
      },
    },
  },
  plugins: [],
};
