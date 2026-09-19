/** Compact spacing and elevation tokens for the mobile product shell. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 40,
};

export const borderRadius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const shadows = {
  none: {
    shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0,
  },
  small: {
    shadowColor: '#102A36', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  medium: {
    shadowColor: '#102A36', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.09, shadowRadius: 6, elevation: 2,
  },
  large: {
    shadowColor: '#102A36', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.14, shadowRadius: 12, elevation: 4,
  },
};

export default { spacing, borderRadius, shadows };
