/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0d1117',
        panel: '#161b22',
        edge: '#2a313c',
        right: '#4ea8de',
        left: '#f4a261',
      },
    },
  },
  plugins: [],
}
