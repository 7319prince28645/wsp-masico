/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#25D366', // WhatsApp Green
        secondary: '#128C7E', // WhatsApp Dark Green
        dark: '#075E54',
      }
    },
  },
  plugins: [],
}
