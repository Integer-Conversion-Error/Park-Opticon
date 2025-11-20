/**
 * Color palette for Parkopticon
 * Export these colors from your Figma design
 */

export const colors = {
  // Primary brand colors
  primary: '#2196F3',      // Blue - Main brand color
  primaryLight: '#64B5F6',
  primaryDark: '#1976D2',
  
  // Secondary colors
  secondary: '#FF9800',    // Orange - Accent color
  secondaryLight: '#FFB74D',
  secondaryDark: '#F57C00',
  
  // Status colors
  success: '#4CAF50',      // Green - Available parking
  error: '#F44336',        // Red - Enforcement/alerts
  warning: '#FFC107',      // Yellow - Warnings
  info: '#2196F3',         // Blue - Info messages
  
  // Neutral colors
  background: '#FFFFFF',
  surface: '#F5F5F5',
  surfaceDark: '#E0E0E0',
  
  // Text colors
  text: {
    primary: '#212121',
    secondary: '#757575',
    disabled: '#BDBDBD',
    inverse: '#FFFFFF',
  },
  
  // Flat text colors for backward compatibility
  text: '#212121',
  textSecondary: '#757575',
  textDisabled: '#BDBDBD',
  textInverse: '#FFFFFF',
  
  // Also add white for background usage
  white: '#FFFFFF',
  
  // Border colors
  border: {
    light: '#E0E0E0',
    medium: '#BDBDBD',
    dark: '#9E9E9E',
  },
  
  // Map marker colors
  marker: {
    parking: '#4CAF50',     // Green for available parking
    enforcement: '#F44336',  // Red for enforcement
    ticket: '#FF9800',      // Orange for ticket locations
    user: '#2196F3',        // Blue for user location
  },
  
  // Shadow color
  shadow: '#000000',
};

export default colors;
