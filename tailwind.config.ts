import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: '#6C4FF0', light: '#9580F4' },
        ink: '#14121B',
        canvas: '#F6F5FA',
        seg: '#EEECF5',
        field: '#FBFAFD',
      },
    },
  },
  plugins: [],
};

export default config;
