/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1a5f2a',
          light: '#2d8a4a',
        },
        secondary: {
          DEFAULT: '#111111',
        },
        accent: {
          DEFAULT: '#ffeb3b',
        },
        danger: {
          DEFAULT: '#dc3545',
        },
        success: {
          DEFAULT: '#28a745',
        },
        dark: {
          DEFAULT: '#0a0a0a',
        },
        light: {
          DEFAULT: '#ffffff',
          bg: '#f7f9fc',
          card: '#ffffff',
          border: '#dce3ee',
          text: '#1e2430',
          subtle: '#5e6878',
        }
      }
    }
  },
  plugins: []
};