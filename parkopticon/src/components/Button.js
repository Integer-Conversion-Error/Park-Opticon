import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../theme';

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
  const { theme, styles } = useThemedStyles(createStyles);
  const isQuiet = variant === 'outline' || variant === 'text' || variant === 'secondary';
  const spinnerColor = isQuiet ? theme.colors.primaryDark : theme.colors.white;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
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

const createStyles = (theme) => StyleSheet.create({
  button: { alignItems: 'center', borderRadius: 16, justifyContent: 'center', overflow: 'hidden' },
  button_small: { minHeight: 44, paddingHorizontal: 14 },
  button_medium: { minHeight: 50, paddingHorizontal: 18 },
  button_large: { minHeight: 56, paddingHorizontal: 22 },
  content: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', maxWidth: '100%' },
  icon: { marginRight: 8 },
  primary: { backgroundColor: theme.colors.primary },
  secondary: { backgroundColor: theme.colors.primaryLight },
  danger: { backgroundColor: theme.colors.dangerBackground },
  outline: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border.medium, borderWidth: 1 },
  text: { backgroundColor: 'transparent' },
  primaryText: { color: theme.colors.white },
  secondaryText: { color: theme.colors.primaryDark },
  dangerText: { color: theme.colors.white },
  outlineText: { color: theme.colors.primaryDark },
  textText: { color: theme.colors.primaryDark },
  buttonText: { flexShrink: 1, fontWeight: '600', textAlign: 'center' },
  text_small: { fontSize: 13 },
  text_medium: { fontSize: 15 },
  text_large: { fontSize: 16 },
  fullWidth: { width: '100%' },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.45 },
});
