import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

export const Button = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon = null,
  style,
  textStyle,
}) => {
  const isQuiet = variant === 'outline' || variant === 'text';
  const spinnerColor = isQuiet ? theme.colors.primary : theme.colors.white;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${size}`],
        styles[variant],
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? <ActivityIndicator color={spinnerColor} /> : (
        <View style={styles.content}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Text style={[styles.buttonText, styles[`text_${size}`], styles[`${variant}Text`], textStyle]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: { alignItems: 'center', borderRadius: 12, justifyContent: 'center', overflow: 'hidden' },
  button_small: { minHeight: 38, paddingHorizontal: 14 },
  button_medium: { minHeight: 46, paddingHorizontal: 18 },
  button_large: { minHeight: 56, paddingHorizontal: 22 },
  content: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  icon: { marginRight: 8 },
  primary: { backgroundColor: theme.colors.primary, ...theme.shadows.medium },
  secondary: { backgroundColor: theme.colors.success, ...theme.shadows.medium },
  danger: { backgroundColor: theme.colors.error, ...theme.shadows.medium },
  outline: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border.medium, borderWidth: 1 },
  text: { backgroundColor: 'transparent' },
  primaryText: { color: theme.colors.white },
  secondaryText: { color: theme.colors.white },
  dangerText: { color: theme.colors.white },
  outlineText: { color: theme.colors.primaryDark },
  textText: { color: theme.colors.primaryDark },
  buttonText: { fontWeight: '700', textAlign: 'center' },
  text_small: { fontSize: 13 },
  text_medium: { fontSize: 14 },
  text_large: { fontSize: 16 },
  fullWidth: { width: '100%' },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.45 },
});
