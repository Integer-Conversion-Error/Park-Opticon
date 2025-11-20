import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../theme';

/**
 * Card Component
 * 
 * Types: parking, alert, ticket
 * Used for list items and detail views
 */
export const Card = ({ 
  type = 'default',
  title,
  subtitle,
  description,
  timestamp,
  distance,
  status,
  badge,
  onPress,
  children,
  style
}) => {
  const getStatusColor = () => {
    if (type === 'parking') return theme.colors.success;
    if (type === 'alert') return theme.colors.error;
    if (type === 'ticket') return theme.colors.warning;
    return theme.colors.textSecondary;
  };

  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container 
      style={[styles.card, style]} 
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {/* Header with title and badge */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          {type !== 'default' && (
            <View style={[styles.indicator, { backgroundColor: getStatusColor() }]} />
          )}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {badge && (
          <View style={[styles.badge, { backgroundColor: getStatusColor() }]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>

      {/* Subtitle */}
      {subtitle && (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      )}

      {/* Description */}
      {description && (
        <Text style={styles.description} numberOfLines={2}>
          {description}
        </Text>
      )}

      {/* Footer with timestamp and distance */}
      {(timestamp || distance) && (
        <View style={styles.footer}>
          {timestamp && (
            <Text style={styles.meta}>
              🕐 {timestamp}
            </Text>
          )}
          {distance && (
            <Text style={styles.meta}>
              📍 {distance}
            </Text>
          )}
        </View>
      )}

      {/* Custom children */}
      {children}
    </Container>
  );
};

export const ParkingCard = (props) => <Card {...props} type="parking" />;
export const AlertCard = (props) => <Card {...props} type="alert" />;
export const TicketCard = (props) => <Card {...props} type="ticket" />;

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xs,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicator: {
    width: 4,
    height: 16,
    borderRadius: 2,
    marginRight: theme.spacing.xs,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  badge: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: theme.spacing.xs,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.white,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  description: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
    marginBottom: theme.spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.xs,
  },
  meta: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
});
