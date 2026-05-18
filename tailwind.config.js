/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#004a99',
          hover: '#003d80',
          light: '#e6eef7',
        },
        accent: {
          DEFAULT: '#00a8e8',
          hover: '#0090c8',
        },
        success: '#28a745',
        danger: '#dc3545',
        warning: '#ffc107',
        // Estados de cotización/OC
        estado: {
          espera:    '#ffc107',
          ganada:    '#28a745',
          perdida:   '#dc3545',
          proceso:   '#00a8e8',
          entregada: '#6c757d',
        },
      },
      borderRadius: {
        card: '10px',
      },
      boxShadow: {
        card: '0 2px 8px rgba(0,0,0,0.08)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.12)',
      },
      fontFamily: {
        sans: ['Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
