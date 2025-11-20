import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { Button, Card, ParkingCard, AlertCard, TicketCard, Input, FAB, FABGroup } from '../components';
import { theme } from '../theme';

export default function ComponentDemoScreen() {
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState('');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.header}>🎨 Component Library Demo</Text>

      {/* Buttons Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Buttons</Text>
        
        <Button 
          title="Primary Button" 
          variant="primary" 
          onPress={() => Alert.alert('Primary', 'You pressed the primary button!')}
          style={styles.demoItem}
        />
        
        <Button 
          title="Secondary Button" 
          variant="secondary" 
          onPress={() => Alert.alert('Secondary', 'You pressed the secondary button!')}
          style={styles.demoItem}
        />
        
        <Button 
          title="Outline Button" 
          variant="outline" 
          onPress={() => Alert.alert('Outline', 'You pressed the outline button!')}
          style={styles.demoItem}
        />
        
        <Button 
          title="Text Button" 
          variant="text" 
          onPress={() => Alert.alert('Text', 'You pressed the text button!')}
          style={styles.demoItem}
        />
        
        <Button 
          title="Danger Button" 
          variant="danger" 
          onPress={() => Alert.alert('Danger', 'You pressed the danger button!')}
          style={styles.demoItem}
        />
        
        <View style={styles.row}>
          <Button 
            title="Small" 
            size="small" 
            onPress={() => {}}
            style={styles.rowItem}
          />
          <Button 
            title="Medium" 
            size="medium" 
            onPress={() => {}}
            style={styles.rowItem}
          />
          <Button 
            title="Large" 
            size="large" 
            onPress={() => {}}
            style={styles.rowItem}
          />
        </View>

        <Button 
          title="Loading Button" 
          loading={true}
          style={styles.demoItem}
        />

        <Button 
          title="Disabled Button" 
          disabled={true}
          style={styles.demoItem}
        />
      </View>

      {/* Cards Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cards</Text>
        
        <ParkingCard
          title="🅿️ Available Parking Spot"
          subtitle="Market St & 5th"
          description="Open spot reported by John D. Great location near downtown!"
          timestamp="5 min ago"
          distance="0.3 mi"
          badge="AVAILABLE"
          onPress={() => Alert.alert('Parking Card', 'You tapped a parking spot!')}
        />

        <AlertCard
          title="🚨 Enforcement Alert"
          subtitle="Mission St & 9th"
          description="Parking enforcement officer spotted writing tickets. Avoid this area!"
          timestamp="12 min ago"
          distance="0.8 mi"
          badge="TICKETING"
          onPress={() => Alert.alert('Alert Card', 'You tapped an enforcement alert!')}
        />

        <TicketCard
          title="🎫 Parking Ticket"
          subtitle="Valencia St & 16th"
          description="Parking meter expired - $75 fine. Due by Nov 15, 2025."
          timestamp="2 days ago"
          badge="UNPAID"
          onPress={() => Alert.alert('Ticket Card', 'You tapped a ticket!')}
        />

        <Card
          title="Generic Card"
          subtitle="This is a subtitle"
          description="This is a generic card component that can be used for any purpose. It's very flexible!"
          timestamp="1 hour ago"
          onPress={() => Alert.alert('Card', 'You tapped a generic card!')}
        />
      </View>

      {/* Inputs Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Inputs</Text>
        
        <Input
          label="Basic Input"
          value={inputValue}
          onChangeText={setInputValue}
          placeholder="Enter some text..."
        />

        <Input
          label="Input with Error"
          value=""
          onChangeText={() => {}}
          placeholder="This field is required"
          error="This field cannot be empty"
        />

        <Input
          label="Multiline Input"
          value="This is a longer text that spans multiple lines. You can type a lot here!"
          onChangeText={() => {}}
          placeholder="Enter description..."
          multiline={true}
          numberOfLines={4}
        />

        <Input
          label="Disabled Input"
          value="Cannot edit this"
          onChangeText={() => {}}
          disabled={true}
        />
      </View>

      {/* FABs Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Floating Action Buttons</Text>
        <Text style={styles.note}>
          Note: FABs are typically positioned absolutely. 
          These are shown inline for demo purposes.
        </Text>
        
        <View style={styles.fabDemo}>
          <FAB
            icon={<Text style={{ fontSize: 24 }}>🅿️</Text>}
            label="Report Spot"
            onPress={() => Alert.alert('FAB', 'Report parking spot!')}
            variant="success"
            position="bottom-center"
            style={{ position: 'relative', bottom: 0, marginBottom: 8 }}
          />
          
          <FAB
            icon={<Text style={{ fontSize: 24 }}>👮</Text>}
            label="Report Alert"
            onPress={() => Alert.alert('FAB', 'Report enforcement!')}
            variant="error"
            position="bottom-center"
            style={{ position: 'relative', bottom: 0, marginBottom: 8 }}
          />
          
          <FAB
            icon={<Text style={{ fontSize: 24 }}>➕</Text>}
            onPress={() => Alert.alert('FAB', 'Icon only FAB!')}
            variant="primary"
            position="bottom-center"
            style={{ position: 'relative', bottom: 0 }}
          />
        </View>
      </View>

      {/* Color Palette */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Color Palette</Text>
        
        <View style={styles.colorGrid}>
          <View style={styles.colorItem}>
            <View style={[styles.colorBox, { backgroundColor: theme.colors.primary }]} />
            <Text style={styles.colorLabel}>Primary</Text>
          </View>
          <View style={styles.colorItem}>
            <View style={[styles.colorBox, { backgroundColor: theme.colors.success }]} />
            <Text style={styles.colorLabel}>Success</Text>
          </View>
          <View style={styles.colorItem}>
            <View style={[styles.colorBox, { backgroundColor: theme.colors.error }]} />
            <Text style={styles.colorLabel}>Error</Text>
          </View>
          <View style={styles.colorItem}>
            <View style={[styles.colorBox, { backgroundColor: theme.colors.warning }]} />
            <Text style={styles.colorLabel}>Warning</Text>
          </View>
        </View>
      </View>

      {/* Typography */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Typography</Text>
        
        <Text style={theme.typography.h1}>Heading 1 - 32px Bold</Text>
        <Text style={theme.typography.h2}>Heading 2 - 24px Bold</Text>
        <Text style={theme.typography.h3}>Heading 3 - 20px Semibold</Text>
        <Text style={theme.typography.h4}>Heading 4 - 18px Semibold</Text>
        <Text style={theme.typography.body}>Body - 16px Regular</Text>
        <Text style={theme.typography.caption}>Caption - 12px Regular</Text>
      </View>

      {/* Spacing */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Spacing (8pt Grid)</Text>
        
        <View style={styles.spacingDemo}>
          <View style={[styles.spacingBox, { width: theme.spacing.xs }]}>
            <Text style={styles.spacingLabel}>XS</Text>
          </View>
          <View style={[styles.spacingBox, { width: theme.spacing.sm }]}>
            <Text style={styles.spacingLabel}>SM</Text>
          </View>
          <View style={[styles.spacingBox, { width: theme.spacing.md }]}>
            <Text style={styles.spacingLabel}>MD</Text>
          </View>
          <View style={[styles.spacingBox, { width: theme.spacing.lg }]}>
            <Text style={styles.spacingLabel}>LG</Text>
          </View>
          <View style={[styles.spacingBox, { width: theme.spacing.xl }]}>
            <Text style={styles.spacingLabel}>XL</Text>
          </View>
        </View>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.md,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
    paddingBottom: theme.spacing.xs,
  },
  demoItem: {
    marginBottom: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  rowItem: {
    flex: 1,
  },
  note: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: theme.spacing.sm,
  },
  fabDemo: {
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderRadius: 12,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  colorItem: {
    alignItems: 'center',
  },
  colorBox: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginBottom: theme.spacing.xs,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  colorLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  spacingDemo: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.xs,
  },
  spacingBox: {
    height: 40,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  spacingLabel: {
    fontSize: 10,
    color: theme.colors.white,
    fontWeight: '600',
  },
});
