/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      colors: {
        // Dark theme (default)
        dark: {
          bg: {
            primary: '#000000',
            secondary: '#150050',
            tertiary: '#3F0071',
          },
          accent: '#610094',
          text: {
            primary: '#FFFFFF',
            secondary: '#B8B8B8',
          },
          border: '#3F0071',
        },
        // Light theme
        light: {
          bg: {
            primary: '#FAFAFA',
            secondary: '#F0F0F5',
            tertiary: '#E8E8F0',
          },
          accent: '#610094',
          text: {
            primary: '#1A1A2E',
            secondary: '#4A4A5A',
          },
          border: '#D0D0E0',
        },
        // Accent colors (shared)
        accent: {
          DEFAULT: '#610094',
          hover: '#7B00B8',
          light: '#8B00D4',
        },
      },
      fontFamily: {
        sans: ['Geist Sans', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms')({
      strategy: 'class', // only apply form styles when using class
    }),
  ],
}
