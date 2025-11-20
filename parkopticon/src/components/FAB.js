import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { theme } from '../theme';

/**
 * Floating Action Button (FAB)
 * 
 * Used for primary actions like "Report Spot" and "Report Enforcement"
 */
export const FAB = ({ 
  icon, 
  label, 
  onPress, 
  variant = 'primary',
  position = 'bottom-right',
  size = 'medium',
  style 
}) => {
  const getPositionStyle = () => {
    const base = { position: 'absolute' };
    
    switch (position) {
      case 'bottom-right':
        return { ...base, bottom: theme.spacing.lg, right: theme.spacing.md };
      case 'bottom-left':
        return { ...base, bottom: theme.spacing.lg, left: theme.spacing.md };
      case 'bottom-center':
        return { ...base, bottom: theme.spacing.lg, alignSelf: 'center' };
      default:
        return { ...base, bottom: theme.spacing.lg, right: theme.spacing.md };
    }
  };

  const getColorStyle = () => {
    switch (variant) {
      case 'primary':
        return { backgroundColor: theme.colors.primary };
      case 'success':
        return { backgroundColor: theme.colors.success };
      case 'error':
        return { backgroundColor: theme.colors.error };
      case 'warning':
        return { backgroundColor: theme.colors.warning };
      default:
        return { backgroundColor: theme.colors.primary };
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return { width: 48, height: 48 };
      case 'medium':
        return { width: 56, height: 56 };
      case 'large':
        return { width: 64, height: 64 };
      default:
        return { width: 56, height: 56 };
    }
  };

  const isExtended = !!label;

  return (
    <TouchableOpacity
      style={[
        styles.fab,
        getPositionStyle(),
        getColorStyle(),
        isExtended ? styles.fabExtended : getSizeStyle(),
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {icon && <View style={isExtended && styles.iconWithLabel}>{icon}</View>}
      {label && <Text style={styles.label}>{label}</Text>}
    </TouchableOpacity>
  );
};

export const FABGroup = ({ children, style }) => {
  const childrenArray = React.Children.toArray(children);
  
  return (
    <View style={[styles.fabGroup, style]}>
      {childrenArray.map((child, index) => (
        <View key={index} style={index > 0 && styles.fabGroupItem}>
          {child}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  fab: {
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabExtended: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    height: 48,
    borderRadius: 24,
    minWidth: 120,
  },
  iconWithLabel: {
    marginRight: theme.spacing.xs,
  },
  label: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  fabGroup: {
    position: 'absolute',
    bottom: theme.spacing.lg,
    right: theme.spacing.md,
  },
  fabGroupItem: {
    marginTop: theme.spacing.sm,
  },
});
