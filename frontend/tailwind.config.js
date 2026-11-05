/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        agri: {
          darkest: '#0A1711',
          dark: '#0F291E',
          forest: '#163A2B',
          card: '#1B4232',
          cardHover: '#23533F',
          border: '#275E47',
          charcoal: '#121614',
          charcoalLight: '#1C221F',
          lime: '#84CC16',
          limeBright: '#A3E635',
          emerald: '#10B981',
          amber: '#F59E0B',
          red: '#EF4444',
          offwhite: '#F4F7F4',
          muted: '#8E9E94'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
