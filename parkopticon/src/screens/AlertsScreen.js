import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { AlertCard } from '../components';
import { theme } from '../theme';

export default function AlertsScreen() {
  const [filter, setFilter] = useState('all'); // all, ticketing, chalking, towing
  const [alerts, setAlerts] = useState([
    {
      id: '1',
      type: 'ticketing',
      location: 'Market St & 5th',
      description: 'Parking enforcement officer writing tickets',
      timestamp: '5 min ago',
      distance: '0.3 mi',
      reporter: 'John D.',
    },
    {
      id: '2',
      type: 'chalking',
      location: 'Mission St & 9th',
      description: 'Enforcement chalking tires',
      timestamp: '12 min ago',
      distance: '0.8 mi',
      reporter: 'Sarah M.',
    },
    {
      id: '3',
      type: 'ticketing',
      location: 'Valencia St & 16th',
      description: 'Multiple officers active',
      timestamp: '18 min ago',
      distance: '1.2 mi',
      reporter: 'Mike K.',
    },
    {
      id: '4',
      type: 'towing',
      location: 'Howard St & 2nd',
      description: 'Tow truck spotted',
      timestamp: '25 min ago',
      distance: '1.5 mi',
      reporter: 'Lisa P.',
    },
  ]);

  const getFilteredAlerts = () => {
    if (filter === 'all') return alerts;
    return alerts.filter((alert) => alert.type === filter);
  };

  const getTypeEmoji = (type) => {
    switch (type) {
      case 'ticketing': return '🎫';
      case 'chalking': return '✏️';
      case 'towing': return '🚛';
      default: return '⚠️';
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'ticketing': return 'Ticketing';
      case 'chalking': return 'Chalking';
      case 'towing': return 'Towing';
      default: return 'Alert';
    }
  };

  return (
    <View style={styles.container}>
      {/* Filter tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All ({alerts.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'ticketing' && styles.filterTabActive]}
          onPress={() => setFilter('ticketing')}
        >
          <Text style={[styles.filterText, filter === 'ticketing' && styles.filterTextActive]}>
            🎫 Ticketing
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'chalking' && styles.filterTabActive]}
          onPress={() => setFilter('chalking')}
        >
          <Text style={[styles.filterText, filter === 'chalking' && styles.filterTextActive]}>
            ✏️ Chalking
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'towing' && styles.filterTabActive]}
          onPress={() => setFilter('towing')}
        >
          <Text style={[styles.filterText, filter === 'towing' && styles.filterTextActive]}>
            🚛 Towing
          </Text>
        </TouchableOpacity>
      </View>

      {/* Alerts list */}
      <FlatList
        data={getFilteredAlerts()}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <AlertCard
            title={`${getTypeEmoji(item.type)} ${item.location}`}
            subtitle={`Reported by ${item.reporter}`}
            description={item.description}
            timestamp={item.timestamp}
            distance={item.distance}
            badge={getTypeBadge(item.type)}
            onPress={() => console.log('Alert pressed:', item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No alerts for this filter</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.white,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  filterTabActive: {
    backgroundColor: theme.colors.primary,
  },
  filterText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  filterTextActive: {
    color: theme.colors.white,
    fontWeight: '600',
  },
  listContent: {
    padding: theme.spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
});
