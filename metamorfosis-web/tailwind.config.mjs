/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'bg-base': '#050a12',
        'bg-surface': '#0c1422',
        'accent-blue': '#007BFF',
        'health-green': '#10e5a0',
        'text-primary': '#f0f6ff',
        'text-secondary': '#8ba3c0',
      },
      fontFamily: {
        heading: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
