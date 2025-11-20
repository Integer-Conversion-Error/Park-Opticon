import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { TicketCard, Button } from '../components';
import { theme } from '../theme';

export default function TicketsScreen() {
  const [tickets, setTickets] = useState([
    {
      id: '1',
      ticketNumber: 'SF-2024-001234',
      amount: '$75.00',
      status: 'unpaid',
      location: 'Market St & 5th',
      date: '2024-11-01',
      violation: 'Parking meter expired',
      dueDate: '2024-11-15',
    },
    {
      id: '2',
      ticketNumber: 'SF-2024-001189',
      amount: '$65.00',
      status: 'appealed',
      location: 'Valencia St & 16th',
      date: '2024-10-28',
      violation: 'Street cleaning violation',
      dueDate: '2024-11-12',
    },
    {
      id: '3',
      ticketNumber: 'SF-2024-001067',
      amount: '$55.00',
      status: 'paid',
      location: 'Mission St & 24th',
      date: '2024-10-15',
      violation: 'Over time limit',
      dueDate: '2024-10-29',
      paidDate: '2024-10-20',
    },
  ]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'unpaid': return theme.colors.error;
      case 'appealed': return theme.colors.warning;
      case 'paid': return theme.colors.success;
      default: return theme.colors.textSecondary;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'unpaid': return 'UNPAID';
      case 'appealed': return 'APPEALED';
      case 'paid': return 'PAID';
      default: return status.toUpperCase();
    }
  };

  const getTotalUnpaid = () => {
    return tickets
      .filter((t) => t.status === 'unpaid')
      .reduce((sum, t) => sum + parseFloat(t.amount.replace('$', '')), 0)
      .toFixed(2);
  };

  return (
    <View style={styles.container}>
      {/* Summary card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Tickets</Text>
          <Text style={styles.summaryValue}>{tickets.length}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Unpaid Amount</Text>
          <Text style={[styles.summaryValue, { color: theme.colors.error }]}>
            ${getTotalUnpaid()}
          </Text>
        </View>
        <Button
          title="Add New Ticket"
          variant="outline"
          size="small"
          onPress={() => console.log('Add ticket')}
          style={styles.addButton}
        />
      </View>

      {/* Tickets list */}
      <FlatList
        data={tickets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TicketCard
            title={`🎫 ${item.ticketNumber}`}
            subtitle={`${item.violation} • ${item.location}`}
            description={`Issued: ${item.date}\nDue: ${item.dueDate}${
              item.paidDate ? `\nPaid: ${item.paidDate}` : ''
            }`}
            badge={getStatusBadge(item.status)}
            onPress={() => console.log('Ticket pressed:', item.id)}
          >
            <View style={styles.ticketFooter}>
              <Text style={styles.amount}>{item.amount}</Text>
              {item.status === 'unpaid' && (
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.actionButton}>
                    <Text style={styles.actionText}>Pay</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton}>
                    <Text style={styles.actionText}>Appeal</Text>
                  </TouchableOpacity>
                </View>
              )}
              {item.status === 'paid' && (
                <Text style={styles.paidText}>✓ Paid</Text>
              )}
            </View>
          </TicketCard>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🎉</Text>
            <Text style={styles.emptyText}>No tickets yet!</Text>
            <Text style={styles.emptySubtext}>You're parking perfectly</Text>
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
  summaryCard: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    margin: theme.spacing.md,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  summaryLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  addButton: {
    marginTop: theme.spacing.xs,
  },
  listContent: {
    padding: theme.spacing.md,
    paddingTop: 0,
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  amount: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.error,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  actionButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.white,
  },
  paidText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.success,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl * 2,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: theme.spacing.md,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
});
