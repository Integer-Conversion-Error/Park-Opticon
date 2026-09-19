/**
 * Compact system typography. The app uses the platform sans-serif
 * (Roboto on Android, San Francisco on iOS) with restrained hierarchy.
 */
export const typography = {
  h1: { fontSize: 28, fontWeight: '800', lineHeight: 34, letterSpacing: -0.4 },
  h2: { fontSize: 22, fontWeight: '800', lineHeight: 28, letterSpacing: -0.2 },
  h3: { fontSize: 17, fontWeight: '700', lineHeight: 23, letterSpacing: 0 },
  h4: { fontSize: 15, fontWeight: '700', lineHeight: 21, letterSpacing: 0 },
  body1: { fontSize: 15, fontWeight: '400', lineHeight: 22, letterSpacing: 0.1 },
  body2: { fontSize: 13, fontWeight: '400', lineHeight: 19, letterSpacing: 0.1 },
  caption: { fontSize: 11, fontWeight: '500', lineHeight: 16, letterSpacing: 0.2 },
  overline: { fontSize: 10, fontWeight: '800', lineHeight: 14, letterSpacing: 1.3, textTransform: 'uppercase' },
  button: { fontSize: 14, fontWeight: '700', lineHeight: 20, letterSpacing: 0.2 },
};

export default typography;
