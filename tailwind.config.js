/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        // Fondo general de la app (arena suave, sin brillo)
        page: '#e6e0d3',
        // Escala "slate" recalibrada a tonos cálidos (papel/arena) para reducir la fatiga visual
        slate: {
          50: '#efeadf',
          100: '#e5dfd1',
          200: '#d5cdbb',
          300: '#bbb29d',
          400: '#867e6c',
          500: '#665f50',
          600: '#4f493d',
          700: '#3b362c',
          800: '#2a2620',
          900: '#1b1915',
          950: '#0f0e0b',
        },
      },
      backgroundColor: {
        // Las tarjetas ya no son blanco puro: crema suave
        white: '#f7f3ea',
      },
      borderColor: {
        white: '#f7f3ea',
      },
    },
  },
  plugins: [],
};
