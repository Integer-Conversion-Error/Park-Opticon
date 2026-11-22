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
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Park Opticon</Text>
          <Text style={styles.title}>{registering ? 'Join the community.' : 'Safer parking, together.'}</Text>
          <Text style={styles.subtitle}>
            {registering ? 'Create an account to sync reports, parking protection, and notifications.' : 'Sign in to sync reports, parking protection, and notifications securely.'}
          </Text>
        </View>

        <View style={styles.card}>
          <Input
            testID="auth-email-input"
            label="Email address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            leftIcon={<Ionicons name="mail-outline" size={18} color={theme.colors.textMuted} />}
            containerStyle={styles.inputField}
          />
          <Input
            testID="auth-password-input"
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
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
              <View style={styles.socialDivider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>
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
              {registering ? 'Already have an account? ' : 'New to Park Opticon? '}
              <Text style={styles.switchTextStrong}>{registering ? 'Sign in' : 'Create an account'}</Text>
            </Text>
          </Pressable>
        </View>

        <View style={styles.privacyCard}>
          <View style={styles.privacyIcon}><Ionicons name="shield-checkmark-outline" size={19} color={theme.colors.primary} /></View>
          <View style={styles.privacyCopy}>
            <Text style={styles.privacyTitle}>Privacy first</Text>
            <Text style={styles.privacyText}>Your account and parked-car details stay protected.</Text>
          </View>
        </View>
        <Pressable accessibilityRole="button" onPress={onGuest} style={styles.guestButton}>
          <Text style={styles.guestButtonText}>Continue as guest</Text>
          <Text style={styles.guestButtonHint}>Use the map without creating an account</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: { backgroundColor: theme.colors.background, flex: 1 },
  content: { paddingHorizontal: theme.spacing.lg },
  header: { marginBottom: theme.spacing.lg },
  eyebrow: { color: theme.colors.primaryDark, fontSize: 14, fontWeight: '600', marginBottom: 10 },
  title: { color: theme.colors.text, fontSize: 32, fontWeight: '700', letterSpacing: -0.8, lineHeight: 38, marginTop: 4 },
  subtitle: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 5 },
  card: { backgroundColor: theme.colors.surface, borderRadius: 24, padding: theme.spacing.md },
  inputField: { marginBottom: theme.spacing.sm },
  submitButton: { marginTop: theme.spacing.xs },
  socialDivider: { alignItems: 'center', flexDirection: 'row', marginTop: theme.spacing.lg, marginBottom: theme.spacing.md },
  dividerLine: { backgroundColor: theme.colors.border.light, flex: 1, height: 1 },
  dividerText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '500', marginHorizontal: theme.spacing.sm },
  socialButton: { alignItems: 'center', backgroundColor: theme.colors.surface, borderColor: theme.colors.border.medium, borderRadius: 16, borderWidth: 1, flexDirection: 'row', height: 50, justifyContent: 'center', paddingHorizontal: theme.spacing.md },
  socialButtonPressed: { opacity: 0.82 },
  socialButtonDisabled: { opacity: 0.48 },
  socialButtonText: { color: theme.colors.text, fontSize: 14, fontWeight: '600', marginLeft: 10 },
  appleButtonWrap: { height: 50, marginTop: theme.spacing.sm },
  appleButton: { height: 50, width: '100%' },
  switchButton: { alignItems: 'center', minHeight: 44, paddingHorizontal: theme.spacing.xs, paddingTop: theme.spacing.md },
  switchText: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  switchTextStrong: { color: theme.colors.primaryDark, fontWeight: '600' },
  privacyCard: { alignItems: 'center', backgroundColor: theme.colors.primaryLight, borderRadius: theme.borderRadius.md, flexDirection: 'row', marginTop: theme.spacing.md, padding: theme.spacing.md },
  privacyIcon: { alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 10, height: 36, justifyContent: 'center', width: 36 },
  privacyCopy: { flex: 1, marginLeft: theme.spacing.sm },
  privacyTitle: { color: theme.colors.primaryDark, fontSize: 14, fontWeight: '600' },
  privacyText: { color: theme.colors.primaryDark, fontSize: 12, lineHeight: 17, marginTop: 2 },
  guestButton: { alignItems: 'center', paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.md },
  guestButtonText: { color: theme.colors.textSecondary, fontSize: 15, fontWeight: '600' },
  guestButtonHint: { color: theme.colors.textMuted, fontSize: 12, marginTop: 3 },
});
