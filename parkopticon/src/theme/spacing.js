/**
 * Spacing system for Parkopticon
 * Based on 8pt grid system
 */

export const spacing = {
  xs: 4,    // Extra small
  sm: 8,    // Small
  md: 16,   // Medium (base unit)
  lg: 24,   // Large
  xl: 32,   // Extra large
  xxl: 48,  // Extra extra large
};

/**
 * Border radius values
 */
export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 16,
  xl: 24,
  full: 9999,  // For circular elements
};

/**
 * Shadow elevations
 * Use these for cards and elevated elements
 */
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
};

export default { spacing, borderRadius, shadows };
