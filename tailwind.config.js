/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        fight: {
          black: '#0B0B0B',
          panel: '#141414',
          panel2: '#1A1A1A',
          line: '#292121',
          red: '#981B1E',
          redDark: '#781517',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        red: '0 0 0 1px rgba(152, 27, 30, 0.34), 0 18px 50px rgba(0, 0, 0, 0.48)',
      },
    },
  },
  plugins: [],
};
