/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        verdict: {
          go: '#16a34a',
          conditional: '#ca8a04',
          nogo: '#dc2626',
          incomplete: '#737373'
        }
      }
    }
  },
  plugins: []
};
