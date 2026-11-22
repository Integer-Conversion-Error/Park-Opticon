/**
 * Parkopticon visual system.
 * A quiet slate canvas, deep ink typography, and a teal action color keep
 * the product legible and operational instead of decorative.
 */
export const colors = {
  primary: '#0B7285',
  primaryLight: '#E6F3F4',
  primaryDark: '#086477',
  secondary: '#D49426',
  secondaryLight: '#FFF2D8',
  secondaryDark: '#9A6412',

  success: '#2D8158',
  successLight: '#E5F4EC',
  error: '#B94A4A',
  errorLight: '#FBE9E8',
  warning: '#B7791F',
  warningLight: '#FFF4D9',
  info: '#2D6CDF',

  background: '#F3F5F6',
  surface: '#FFFFFF',
  surfaceSubtle: '#EDF3F4',
  surfaceDark: '#DDE7EA',

  text: '#172A32',
  textSecondary: '#617178',
  textMuted: '#617178',
  textDisabled: '#AAB7BD',
  textInverse: '#FFFFFF',
  white: '#FFFFFF',

  border: {
    light: '#E4EAEC',
    medium: '#C5D3D8',
    dark: '#91A5AD',
  },

  marker: {
    parking: '#2D8158',
    enforcement: '#B94A4A',
    ticket: '#D49426',
    user: '#0B7285',
  },

  shadow: '#102A36',
  navigationSurface: 'rgba(255,255,255,0.96)',
  backdrop: 'rgba(19,36,47,0.20)',
  mapBackground: '#ECEFE9',
  dangerBackground: '#B94A4A',
};

export const darkColors = {
  ...colors,
  primaryLight: '#233F47',
  primaryDark: '#88D6DF',
  secondary: '#E6BA72',
  secondaryLight: '#463C2B',
  secondaryDark: '#E6BA72',
  success: '#97C8A9',
  successLight: '#2A4036',
  error: '#F39791',
  errorLight: '#483335',
  warning: '#E6BA72',
  warningLight: '#463C2B',
  info: '#8FBFFA',
  background: '#141D22',
  surface: '#202A2F',
  surfaceSubtle: '#2D3A40',
  surfaceDark: '#36434A',
  text: '#EDF4F5',
  textSecondary: '#A6B6BD',
  textMuted: '#A6B6BD',
  textDisabled: '#6D818C',
  border: { light: '#36434A', medium: '#4C606A', dark: '#7A929D' },
  marker: { parking: '#97C8A9', enforcement: '#F39791', ticket: '#E6BA72', user: '#88D6DF' },
  shadow: '#000000',
  navigationSurface: 'rgba(32,42,47,0.97)',
  backdrop: 'rgba(4,10,13,0.44)',
  mapBackground: '#202C30',
};

export default colors;
