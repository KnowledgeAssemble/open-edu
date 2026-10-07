import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  tailwindAnimationExtensions,
  tailwindColorExtensions,
  tailwindElevationExtensions,
  tailwindFontFamilyExtensions,
  tailwindFontSizeExtensions,
  tailwindSpacingExtensions,
  tailwindRadiusExtensions,
  tailwindTransitionDurationExtensions,
  tailwindTransitionTimingExtensions,
  tailwindSizingExtensions,
  tailwindComponentHeightExtensions,
  tailwindMinWidthExtensions,
  tailwindOpacityExtensions,
  tailwindBorderWidthExtensions,
  tailwindFocusExtensions,
  tailwindIconSizeExtensions,
  tailwindLayoutExtensions,
} from '@open-edu/design-system/tokens';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    resolve(__dirname, './index.html'),
    resolve(__dirname, './src/**/*.{ts,tsx}'),
    resolve(__dirname, '../../packages/runtime/src/**/*.{ts,tsx}'),
    resolve(__dirname, '../../packages/design-system/src/**/*.{ts,tsx}'),
    resolve(__dirname, '../../packages/widgets/src/**/*.{ts,tsx}'),
    resolve(__dirname, '../../packages/interactive-runtime/src/**/*.{ts,tsx}'),
  ],
  theme: {
    extend: {
      boxShadow: tailwindElevationExtensions,
      colors: tailwindColorExtensions,
      fontFamily: tailwindFontFamilyExtensions,
      fontSize: tailwindFontSizeExtensions,
      spacing: { ...tailwindSpacingExtensions, paragraph: 'var(--oe-paragraph-spacing)' },
      borderRadius: tailwindRadiusExtensions,
      transitionDuration: tailwindTransitionDurationExtensions,
      transitionTimingFunction: tailwindTransitionTimingExtensions,
      width: {
        ...tailwindSizingExtensions,
        ...tailwindLayoutExtensions,
      },
      height: {
        ...tailwindComponentHeightExtensions,
        ...tailwindSizingExtensions,
        header: 'var(--oe-layout-header-height)',
      },
      minWidth: tailwindMinWidthExtensions,
      maxWidth: {
        ...tailwindLayoutExtensions,
        reading: 'var(--oe-reading-width)',
      },
      opacity: tailwindOpacityExtensions,
      borderWidth: tailwindBorderWidthExtensions,
      ringWidth: { DEFAULT: tailwindFocusExtensions['width'] },
      ringOffset: { DEFAULT: tailwindFocusExtensions['offset'] },
      ringColor: { DEFAULT: tailwindFocusExtensions['color'] },
      gap: tailwindLayoutExtensions,
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        ...tailwindAnimationExtensions,
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
