import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Input } from '../components';
import { useThemedStyles } from '../theme';
import { api } from '../services/api';
import { getSocialAuthPayload, isGoogleSignInSupported, isSocialAuthCancelled, socialProviderLabels } from '../services/socialAuth';
import { useAppModal } from '../components/AppModal';

export default function AuthScreen({ onAuthenticated, onGuest }) {
  const { theme, styles } = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { showModal } = useAppModal();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registering, setRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState('');
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return undefined;
    let active = true;
    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (active) setAppleAvailable(available);
      })
      .catch(() => {
        if (active) setAppleAvailable(false);
      });
    return () => { active = false; };
  }, []);

  const submit = async () => {
    if (!email.trim() || password.length < 8) {
      showModal('Check your details', 'Enter a valid email and a password with at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      if (registering) {
        await api.register({ email: email.trim(), password, username: email.trim().split('@')[0] });
      } else {
        await api.login({ email: email.trim(), password });
      }
      onAuthenticated();
    } catch (error) {
      showModal('Could not sign in', error.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const submitSocial = async (provider) => {
    if (loading || socialLoading) return;
    setSocialLoading(provider);
    try {
      const payload = await getSocialAuthPayload(provider, { includeProfile: true });
      await api.socialLogin(payload);
      onAuthenticated();
    } catch (error) {
      if (!isSocialAuthCancelled(error)) {
        showModal(`Could not continue with ${socialProviderLabels[provider]}`, error.message || 'Please try again.');
      }
    } finally {
      setSocialLoading('');
    }
  };

  const showSocialOptions = isGoogleSignInSupported() || appleAvailable;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.spacing.xl, paddingBottom: insets.bottom + theme.spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text accessibilityRole="header" style={styles.title}>
          {registering ? 'Create an account' : 'Sign in to Park Opticon'}
        </Text>

        <View style={styles.card}>
          <Input
            testID="auth-email-input"
            label="Email"
            accessibilityLabel="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            leftIcon={<Ionicons name="mail-outline" size={18} color={theme.colors.textMuted} />}
            containerStyle={styles.inputField}
          />
          <Input
            testID="auth-password-input"
            label="Password"
            accessibilityLabel="Password"
            value={password}
            onChangeText={setPassword}
            placeholder={registering ? 'At least 8 characters' : undefined}
            autoCapitalize="none"
            autoComplete="password"
            secureTextEntry
            leftIcon={<Ionicons name="lock-closed-outline" size={18} color={theme.colors.textMuted} />}
            containerStyle={styles.inputField}
          />
          <Button
            title={registering ? 'Create account' : 'Sign in'}
            onPress={submit}
            loading={loading}
            disabled={Boolean(socialLoading)}
            fullWidth
            size="large"
            style={styles.submitButton}
          />
          {showSocialOptions ? (
            <>
              <View style={styles.socialDivider} />
              {isGoogleSignInSupported() ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Google"
                  accessibilityState={{ busy: socialLoading === 'google', disabled: Boolean(loading || socialLoading) }}
                  disabled={Boolean(loading || socialLoading)}
                  onPress={() => submitSocial('google')}
                  style={({ pressed }) => [styles.socialButton, pressed && !loading && !socialLoading && styles.socialButtonPressed]}
                >
                  <Ionicons name="logo-google" size={18} color="#4285F4" />
                  <Text style={styles.socialButtonText}>{socialLoading === 'google' ? 'Connecting…' : 'Continue with Google'}</Text>
                </Pressable>
              ) : null}
              {appleAvailable ? (
                <View pointerEvents={loading || socialLoading ? 'none' : 'auto'} style={[styles.appleButtonWrap, (loading || socialLoading) && styles.socialButtonDisabled]}>
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                    buttonStyle={theme.dark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={12}
                    onPress={() => submitSocial('apple')}
                    style={styles.appleButton}
                  />
                </View>
              ) : null}
            </>
          ) : null}
          <Pressable accessibilityRole="button" onPress={() => setRegistering((value) => !value)} style={styles.switchButton}>
            <Text style={styles.switchText}>
              {registering ? 'Back to sign in' : 'Create an account'}
            </Text>
          </Pressable>
        </View>

        <Pressable accessibilityRole="button" onPress={onGuest} style={styles.guestButton}>
          <Text style={styles.guestButtonText}>Continue as guest</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: { backgroundColor: theme.colors.background, flex: 1 },
  content: { paddingHorizontal: theme.spacing.lg },
  title: { color: theme.colors.text, fontSize: 32, fontWeight: '700', letterSpacing: -0.8, lineHeight: 38, marginBottom: theme.spacing.lg },
  card: { backgroundColor: theme.colors.surface, borderRadius: 24, padding: theme.spacing.md },
  inputField: { marginBottom: theme.spacing.sm },
  submitButton: { marginTop: theme.spacing.xs },
  socialDivider: { backgroundColor: theme.colors.border.light, height: StyleSheet.hairlineWidth, marginVertical: theme.spacing.md },
  socialButton: { alignItems: 'center', backgroundColor: theme.colors.surface, borderColor: theme.colors.border.medium, borderRadius: 16, borderWidth: 1, flexDirection: 'row', height: 50, justifyContent: 'center', paddingHorizontal: theme.spacing.md },
  socialButtonPressed: { opacity: 0.82 },
  socialButtonDisabled: { opacity: 0.48 },
  socialButtonText: { color: theme.colors.text, fontSize: 14, fontWeight: '600', marginLeft: 10 },
  appleButtonWrap: { height: 50, marginTop: theme.spacing.sm },
  appleButton: { height: 50, width: '100%' },
  switchButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, marginTop: theme.spacing.xs },
  switchText: { color: theme.colors.primaryDark, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  guestButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, marginTop: theme.spacing.sm },
  guestButtonText: { color: theme.colors.textSecondary, fontSize: 15, fontWeight: '600' },
});
