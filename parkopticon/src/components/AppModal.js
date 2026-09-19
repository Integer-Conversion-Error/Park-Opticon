import { createContext, useContext, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

const ModalContext = createContext(null);

export function AppModalProvider({ children }) {
  const [state, setState] = useState(null);

  const hideModal = () => setState(null);
  const showModal = (title, message, buttons = [{ text: 'OK' }]) => {
    setState({ title, message, buttons });
  };

  const value = useMemo(() => ({ showModal, hideModal }), []);

  return (
    <ModalContext.Provider value={value}>
      {children}
      <Modal
        visible={Boolean(state)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={hideModal}
      >
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name="information-circle-outline" size={23} color={theme.colors.primary} />
            </View>
            <Text style={styles.title}>{state?.title}</Text>
            <Text style={styles.message}>{state?.message}</Text>
            <View style={[styles.actions, state?.buttons?.length > 1 && styles.actionsMultiple]}>
              {(state?.buttons || []).map((button, index) => (
                <Pressable
                  key={`${button.text}-${index}`}
                  accessibilityRole="button"
                  onPress={async () => {
                    hideModal();
                    try {
                      if (button.onPress) await button.onPress();
                    } catch {
                      // Action-level errors are handled by the screen that opened the modal.
                    }
                  }}
                  style={({ pressed }) => [
                    styles.action,
                    state.buttons.length > 1 && styles.actionMultiple,
                    button.style === 'destructive' && styles.destructiveAction,
                    button.style === 'cancel' && styles.cancelAction,
                    pressed && styles.pressed,
                  ]}
                >
                  {button.loading ? <ActivityIndicator color={theme.colors.white} /> : <Text style={[styles.actionText, button.style === 'destructive' && styles.destructiveText, button.style === 'cancel' && styles.cancelText]}>{button.text}</Text>}
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </ModalContext.Provider>
  );
}

export function useAppModal() {
  const context = useContext(ModalContext);
  if (!context) throw new Error('useAppModal must be used inside AppModalProvider');
  return context;
}

const styles = StyleSheet.create({
  backdrop: { alignItems: 'center', backgroundColor: 'rgba(18,35,45,0.42)', flex: 1, justifyContent: 'center', padding: theme.spacing.lg },
  card: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border.light, borderRadius: theme.borderRadius.lg, borderWidth: 1, maxWidth: 380, padding: theme.spacing.lg, width: '100%', ...theme.shadows.large },
  iconWrap: { alignItems: 'center', alignSelf: 'center', backgroundColor: theme.colors.primaryLight, borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  title: { color: theme.colors.text, fontSize: 19, fontWeight: '800', marginTop: theme.spacing.md, textAlign: 'center' },
  message: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: theme.spacing.xs, textAlign: 'center' },
  actions: { marginTop: theme.spacing.lg },
  actionsMultiple: { flexDirection: 'row-reverse', gap: theme.spacing.sm },
  action: { alignItems: 'center', backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.md, justifyContent: 'center', minHeight: 46, paddingHorizontal: theme.spacing.md },
  actionMultiple: { flex: 1 },
  destructiveAction: { backgroundColor: theme.colors.error },
  cancelAction: { backgroundColor: theme.colors.surfaceSubtle },
  actionText: { color: theme.colors.white, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  destructiveText: { color: theme.colors.white },
  cancelText: { color: theme.colors.textSecondary },
  pressed: { opacity: 0.78 },
});
