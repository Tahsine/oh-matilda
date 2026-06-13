/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          hover: 'var(--color-surface-hover)',
        },
        border: 'var(--color-border)',
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          subtle: 'var(--color-text-subtle)',
        },
        icon: 'var(--color-icon)',
        chevron: 'var(--color-chevron)',
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
        },
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        info: 'var(--color-info)',
        code: {
          text: 'var(--color-code-text)',
          bg: 'var(--color-code-bg)',
          block: 'var(--color-code-block-bg)',
        },
        link: 'var(--color-link)',
        input: {
          bg: 'var(--color-input-bg)',
          placeholder: 'var(--color-input-placeholder)',
        },
        overlay: 'var(--color-modal-overlay)',
        skeleton: 'var(--color-skeleton)',
      },
      fontFamily: {
        sans: ['SpaceGrotesk'],
        mono: ['JetBrainsMono'],
      },
    },
  },
  plugins: [],
}
