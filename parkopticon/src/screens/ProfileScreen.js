import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useThemedStyles } from '../theme';
import { Button, Input } from '../components';
import { apiAvailable, api } from '../services/api';
import { emitSignedOut } from '../services/authEvents';
import { getSocialAuthPayload, isGoogleSignInSupported, isSocialAuthCancelled, socialProviderLabels } from '../services/socialAuth';
import { useAppModal } from '../components/AppModal';

const SUPPORT_EMAIL = 'esad.n.kaya@gmail.com';
const SUPPORT_MAILTO_URL = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Parkopticon - ')}&body=${encodeURIComponent('Please describe the issue and attach screenshots if helpful.\n\n')}`;

const formatCount = (value) => Number(value || 0).toLocaleString();

const formatConnection = (identity) => {
  if (!identity) return 'Not linked';
  if (!identity.connected_at) return 'Connected';
  const connectedAt = new Date(identity.connected_at);
  if (Number.isNaN(connectedAt.getTime())) return 'Connected';
  return `Connected ${connectedAt.toLocaleDateString()}`;
};

const canReauthenticateWithProvider = (provider, appleAvailable) => (
  (provider === 'google' && isGoogleSignInSupported())
  || (provider === 'apple' && appleAvailable)
);

const getInitials = (value) => {
  const initials = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return initials || 'P';
};

export default function ProfileScreen({ navigation }) {
  const { theme, styles } = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const guestMode = !apiAvailable();
  const isFocused = useIsFocused();
  const { showModal } = useAppModal();
  const [profile, setProfile] = useState(null);
  const [impact, setImpact] = useState(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState('');
  const [identities, setIdentities] = useState([]);
  const [identitiesLoading, setIdentitiesLoading] = useState(false);
  const [identitiesError, setIdentitiesError] = useState('');
  const [passwordAvailable, setPasswordAvailable] = useState(false);
  const [linkingProvider, setLinkingProvider] = useState('');
  const [linkFlow, setLinkFlow] = useState(null);
  const [reauthPassword, setReauthPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [reauthLoading, setReauthLoading] = useState(false);
  const [reauthenticationMethod, setReauthenticationMethod] = useState('');
  const [targetLinkLoading, setTargetLinkLoading] = useState(false);
  const [linkFlowError, setLinkFlowError] = useState('');
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [signInMethodsExpanded, setSignInMethodsExpanded] = useState(false);

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

  useEffect(() => {
    if (guestMode) {
      setProfile(null);
      setImpact(null);
      setImpactLoading(false);
      setImpactError('');
      setIdentities([]);
      setIdentitiesLoading(false);
      setIdentitiesError('');
      setPasswordAvailable(false);
      setLinkingProvider('');
      setLinkFlow(null);
      setReauthPassword('');
      setMfaCode('');
      setReauthLoading(false);
      setReauthenticationMethod('');
      setTargetLinkLoading(false);
      setLinkFlowError('');
      return undefined;
    }
    if (!isFocused) return undefined;

    let active = true;
    setImpactLoading(true);
    setImpactError('');
    Promise.all([api.profile(), api.communityImpact()])
      .then(([profileResponse, impactResponse]) => {
        if (!active) return;
        setProfile(profileResponse?.user || profileResponse);
        setImpact(impactResponse);
      })
      .catch((error) => {
        if (!active) return;
        setImpactError(error?.status === 404
          ? 'Community metrics are not available on this server yet.'
          : 'Could not load your community activity.');
      })
      .finally(() => {
        if (active) setImpactLoading(false);
      });

    setIdentitiesLoading(true);
    setIdentitiesError('');
    api.identities()
      .then((response) => {
        if (!active) return;
        setIdentities(Array.isArray(response?.identities) ? response.identities : []);
        setPasswordAvailable(Boolean(response?.password_available));
      })
      .catch((error) => {
        if (!active) return;
        setIdentitiesError(error?.status === 404
          ? 'Linked sign-in methods are not available on this server yet.'
          : 'Could not load linked sign-in methods.');
        setPasswordAvailable(false);
      })
      .finally(() => {
        if (active) setIdentitiesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [guestMode, isFocused, reloadKey]);

  const displayName = guestMode
    ? 'Guest driver'
    : profile?.full_name || profile?.username || 'Your account';
  const displayEmail = guestMode
    ? 'Saved on this device'
    : profile?.email || (impactLoading ? 'Loading account details…' : 'Account details unavailable');
  const hasCommunityActivity = impact && [
    impact.reports_shared,
    impact.reports_checked,
    impact.drivers_alerted,
  ].some((value) => Number(value) > 0);
  const impactMetrics = impact ? [
    {
      icon: 'share-social-outline',
      value: impact.reports_shared,
      label: 'Reports shared',
      detail: `${formatCount(impact.open_spots_shared)} spots · ${formatCount(impact.enforcement_alerts_reported)} alerts`,
    },
    {
      icon: 'people-outline',
      value: impact.reports_confirmed,
      label: 'Reports confirmed',
      detail: 'Confirmed by another driver',
    },
    {
      icon: 'checkmark-circle-outline',
      value: impact.reports_checked,
      label: 'Reports checked',
      detail: `${formatCount(impact.confirmations_given)} confirmed · ${formatCount(impact.corrections_given)} corrected`,
    },
    {
      icon: 'notifications-outline',
      value: impact.drivers_alerted,
      label: 'Drivers alerted',
      detail: 'Unique accounts notified',
    },
  ] : [];
  const identityProviders = [
    ...(isGoogleSignInSupported() ? [{ provider: 'google', icon: 'logo-google' }] : []),
    ...(appleAvailable ? [{ provider: 'apple', icon: 'logo-apple' }] : []),
  ];
  const mfaRequired = Boolean(profile?.mfa_enabled);
  const reauthenticationProviders = identities.filter((identity) => (
    canReauthenticateWithProvider(identity.provider, appleAvailable)
  ));

  const resetLinkFlow = () => {
    setLinkFlow(null);
    setReauthPassword('');
    setMfaCode('');
    setReauthenticationMethod('');
    setLinkFlowError('');
  };

  const cancelLinkFlow = () => {
    if (reauthLoading || targetLinkLoading) return;
    resetLinkFlow();
    setLinkingProvider('');
  };

  const beginLinkIdentity = (provider) => {
    if (linkingProvider || identitiesLoading) return;
    if (!profile) {
      showModal('Account details unavailable', 'Wait for your account details to load, then try linking a sign-in method again.');
      return;
    }
    setLinkingProvider(provider);
    setReauthPassword('');
    setMfaCode('');
    setLinkFlowError('');
    setLinkFlow({ targetProvider: provider, stage: 'reauthentication', reauthenticationToken: '' });
  };

  const completeReauthentication = async (method) => {
    const targetProvider = linkFlow?.targetProvider;
    if (!targetProvider || reauthLoading) return;

    const password = reauthPassword;
    const normalizedMFACode = mfaCode.trim();
    if (method === 'password' && !password) {
      setLinkFlowError('Enter your current password to continue.');
      return;
    }
    if (mfaRequired && !normalizedMFACode) {
      setLinkFlowError('Enter your authenticator or recovery code to continue.');
      return;
    }

    setReauthLoading(true);
    setReauthenticationMethod(method);
    setLinkFlowError('');
    // Credentials are held only long enough to issue the server-side, short-lived
    // reauthentication token; never keep the password or MFA code after submission.
    setReauthPassword('');
    setMfaCode('');
    try {
      const credential = method === 'password'
        ? { password }
        : await getSocialAuthPayload(method);
      const response = await api.reauthenticate({
        ...credential,
        ...(normalizedMFACode ? { mfa_code: normalizedMFACode } : {}),
      });
      if (!response?.reauthentication_token) {
        throw new Error('Could not confirm your account. Please try again.');
      }
      setLinkFlow((current) => (
        current?.targetProvider === targetProvider
          ? { ...current, stage: 'target-credential', reauthenticationToken: response.reauthentication_token }
          : current
      ));
    } catch (error) {
      if (!isSocialAuthCancelled(error)) {
        setLinkFlowError(error.message || 'Could not confirm your account. Please try again.');
      }
    } finally {
      setReauthLoading(false);
      setReauthenticationMethod('');
    }
  };

  const completeLinkIdentity = async () => {
    const targetProvider = linkFlow?.targetProvider;
    const reauthenticationToken = linkFlow?.reauthenticationToken;
    if (!targetProvider || !reauthenticationToken || targetLinkLoading) return;

    setTargetLinkLoading(true);
    setLinkFlowError('');
    try {
      const payload = await getSocialAuthPayload(targetProvider);
      const response = await api.linkIdentity({
        ...payload,
        reauthentication_token: reauthenticationToken,
      });
      if (response?.identity) {
        setIdentities((current) => [
          ...current.filter((identity) => identity.provider !== response.identity.provider),
          response.identity,
        ]);
      } else {
        setReloadKey((current) => current + 1);
      }
      resetLinkFlow();
      setLinkingProvider('');
      showModal('Account linked', `You can now sign in with ${socialProviderLabels[targetProvider]}.`);
    } catch (error) {
      if (error?.code === 'reauthentication_required') {
        setLinkFlow((current) => (
          current?.targetProvider === targetProvider
            ? { ...current, stage: 'reauthentication', reauthenticationToken: '' }
            : current
        ));
        setLinkFlowError('Your security confirmation expired. Confirm your account again to continue.');
      } else if (!isSocialAuthCancelled(error)) {
        setLinkFlowError(error.message || `Could not link ${socialProviderLabels[targetProvider]}. Please try again.`);
      }
    } finally {
      setTargetLinkLoading(false);
    }
  };

  const renderReauthenticationProviderOptions = () => {
    if (reauthLoading) {
      return reauthenticationMethod === 'password' ? null : (
        <View style={styles.reauthWorking}>
          <ActivityIndicator color={theme.colors.primaryDark} size="small" />
          <Text style={styles.reauthWorkingText}>Confirming your account…</Text>
        </View>
      );
    }
    if (!reauthenticationProviders.length) {
      return <Text style={styles.reauthUnavailableText}>No linked sign-in method is available on this device. Sign in on a device that supports one of your linked methods.</Text>;
    }
    return reauthenticationProviders.map((identity, index) => (
      <View key={identity.provider} style={index > 0 ? styles.reauthProviderSpacer : null}>
        {identity.provider === 'apple' ? (
          <View style={styles.reauthAppleButtonWrap}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={(theme.dark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK)}
              cornerRadius={12}
              onPress={() => completeReauthentication(identity.provider)}
              style={styles.reauthAppleButton}
            />
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Confirm with Google"
            onPress={() => completeReauthentication(identity.provider)}
            style={({ pressed }) => [styles.reauthGoogleButton, pressed && styles.reauthGoogleButtonPressed]}
          >
            <Ionicons name="logo-google" size={18} color="#4285F4" />
            <Text style={styles.reauthGoogleButtonText}>Continue with Google</Text>
          </Pressable>
        )}
      </View>
    ));
  };

  const signOut = async () => {
    if (apiAvailable()) {
      await api.updatePushToken(null).catch(() => {});
      await api.logout();
    }
    emitSignedOut();
    showModal('Signed out', 'Your local private session data was cleared.');
  };

  const openSupportEmail = () => {
    Linking.openURL(SUPPORT_MAILTO_URL).catch(() => {
      // The visible address in the row remains available if no mail app handles mailto links.
    });
  };

  const renderSignInMethods = () => (
    <View style={styles.signInMethodsDetails}>
      <Text style={styles.signInMethodsIntro}>Link a provider you own to use it for future sign-ins.</Text>
      {identitiesLoading ? (
        <View style={styles.identityLoading}>
          <ActivityIndicator color={theme.colors.primaryDark} />
          <Text style={styles.identityLoadingText}>Loading linked sign-in methods…</Text>
        </View>
      ) : identitiesError ? (
        <View style={styles.identityError}>
          <Text style={styles.identityErrorText}>{identitiesError}</Text>
          <Pressable accessibilityRole="button" onPress={() => setReloadKey((current) => current + 1)} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : identityProviders.length ? identityProviders.map((provider, index) => {
        const identity = identities.find((item) => item.provider === provider.provider);
        const isLinking = linkingProvider === provider.provider;
        return (
          <View key={provider.provider} style={[styles.signInMethodRow, index > 0 && styles.rowBorder]}>
            <View style={styles.signInMethodLeading}>
              <View style={styles.signInMethodIcon}>
                <Ionicons name={provider.icon} size={20} color={provider.provider === 'google' ? '#4285F4' : theme.colors.text} />
              </View>
              <View style={styles.signInMethodCopy}>
                <Text style={styles.signInMethodTitle}>{socialProviderLabels[provider.provider]}</Text>
                <Text style={styles.signInMethodStatus}>{formatConnection(identity)}</Text>
              </View>
            </View>
            {identity ? (
              <View style={styles.connectedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={theme.colors.success} />
                <Text style={styles.connectedBadgeText}>Linked</Text>
              </View>
            ) : isLinking ? (
              <ActivityIndicator color={theme.colors.primaryDark} size="small" />
            ) : provider.provider === 'apple' ? (
              <View pointerEvents={linkingProvider ? 'none' : 'auto'} style={styles.appleLinkButtonWrap}>
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={(theme.dark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK)}
                  cornerRadius={8}
                  onPress={() => beginLinkIdentity(provider.provider)}
                  style={styles.appleLinkButton}
                />
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Link Google account"
                disabled={Boolean(linkingProvider || linkFlow)}
                onPress={() => beginLinkIdentity(provider.provider)}
                style={({ pressed }) => [styles.linkButton, pressed && !linkingProvider && styles.linkButtonPressed]}
              >
                <Text style={styles.linkButtonText}>Link</Text>
              </Pressable>
            )}
          </View>
        );
      }) : (
        <Text style={styles.identityEmptyText}>Sign-in methods are available in the Parkopticon iOS and Android apps.</Text>
      )}
    </View>
  );

  const showImpactExplanation = () => showModal(
    'How impact is counted',
    'Reports shared are your open-spot shares and original enforcement alerts. A report is confirmed when another driver confirms it. Reports checked are your current confirmations or corrections. Drivers alerted counts unique other accounts for which Parkopticon created an enforcement notification from one of your original alerts; it is not a delivery or read count.',
  );

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: tabBarHeight + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text accessibilityRole="header" style={styles.title}>Account</Text>

        <View style={styles.identityCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{guestMode ? 'G' : getInitials(displayName)}</Text></View>
          <View style={styles.identityCopy}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userEmail}>{displayEmail}</Text>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionLabel}>Community impact</Text>
          {!guestMode && impact && hasCommunityActivity ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Learn how community impact is counted"
              onPress={showImpactExplanation}
              style={styles.impactHelp}
            >
              <Text style={styles.impactHelpText}>How counted</Text>
            </Pressable>
          ) : null}
        </View>
        {guestMode ? (
          <View style={styles.impactStatusCard}>
            <View style={styles.impactStatusIcon}><Ionicons name="person-outline" size={20} color={theme.colors.primaryDark} /></View>
            <View style={styles.impactStatusCopy}>
              <Text style={styles.impactStatusTitle}>Sign in to track your impact</Text>
              <Text style={styles.impactStatusText}>Guest reports and settings stay on this device.</Text>
            </View>
          </View>
        ) : impactLoading && !impact ? (
          <View style={styles.impactStatusCard}>
            <ActivityIndicator color={theme.colors.primaryDark} />
            <Text style={styles.impactLoadingText}>Loading your community activity…</Text>
          </View>
        ) : impact && hasCommunityActivity ? (
          <>
            {impactError ? <Text style={styles.impactSyncWarning}>Could not refresh. Showing the last loaded activity.</Text> : null}
            <View style={styles.statsCard}>
              {impactMetrics.map((metric, index) => (
                <View
                  key={metric.label}
                  accessible
                  accessibilityLabel={`${metric.label}: ${formatCount(metric.value)}. ${metric.detail}`}
                  style={[
                    styles.stat,
                    index % 2 === 0 && styles.statRightBorder,
                  ]}
                >
                  <Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} style={styles.statValue}>{formatCount(metric.value)}</Text>
                  <Text style={styles.statLabel}>{metric.label}</Text>
                </View>
              ))}
            </View>
          </>
        ) : impact ? (
          <View style={styles.impactStatusCard}>
            <View style={styles.impactStatusIcon}><Ionicons name="pulse-outline" size={20} color={theme.colors.primaryDark} /></View>
            <View style={styles.impactStatusCopy}>
              <Text style={styles.impactStatusTitle}>No community activity yet</Text>
              <Text style={styles.impactStatusText}>Share an open spot, report enforcement, or check a nearby report to start a transparent contribution history.</Text>
            </View>
          </View>
        ) : (
          <View style={styles.impactStatusCard}>
            <View style={styles.impactStatusCopy}>
              <Text style={styles.impactStatusTitle}>Community activity unavailable</Text>
              <Text style={styles.impactStatusText}>{impactError || 'We did not replace it with estimates. Try again when you are online.'}</Text>
              <Pressable accessibilityRole="button" onPress={() => setReloadKey((current) => current + 1)} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Try again</Text>
              </Pressable>
            </View>
          </View>
        )}

        <Text style={[styles.sectionLabel, styles.preferencesLabel]}>Preferences</Text>
        <View style={styles.card}>
          {!guestMode ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign-in methods"
                accessibilityState={{ expanded: signInMethodsExpanded }}
                onPress={() => setSignInMethodsExpanded((current) => !current)}
                style={styles.accountRow}
              >
                <Ionicons name="key-outline" size={21} color={theme.colors.textSecondary} />
                <View style={styles.rowCopy}><Text style={styles.rowTitle}>Sign-in methods</Text></View>
                <Ionicons name={signInMethodsExpanded ? 'chevron-up' : 'chevron-forward'} size={17} color={theme.colors.textSecondary} />
              </Pressable>
              {signInMethodsExpanded ? renderSignInMethods() : null}
              <View style={styles.rowBorder} />
            </>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notification controls"
            onPress={() => navigation.navigate('Settings')}
            style={styles.accountRow}
          >
            <Ionicons name="options-outline" size={21} color={theme.colors.textSecondary} />
            <View style={styles.rowCopy}><Text style={styles.rowTitle}>Notification controls</Text></View>
            <Ionicons name="chevron-forward" size={17} color={theme.colors.textSecondary} />
          </Pressable>
          <View style={styles.rowBorder} />
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Email Parkopticon support"
            accessibilityHint="Opens an email with the Parkopticon subject prefix"
            onPress={openSupportEmail}
            style={styles.accountRow}
          >
            <Ionicons name="help-circle-outline" size={21} color={theme.colors.textSecondary} />
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Support</Text>
              <Text selectable style={styles.rowSubtitle}>{SUPPORT_EMAIL}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={theme.colors.textSecondary} />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={guestMode ? 'Leave guest mode' : 'Sign out'}
          onPress={() => showModal(guestMode ? 'Leave guest mode' : 'Sign out', guestMode ? 'Return to the sign-in screen? Local guest data will remain on this device.' : 'Sign out of this device?', [{ text: 'Cancel', style: 'cancel' }, { text: guestMode ? 'Continue' : 'Sign out', style: 'destructive', onPress: signOut }])}
          style={styles.signOutButton}
        >
          <Text style={styles.signOutText}>{guestMode ? 'Leave guest mode' : 'Sign out'}</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={Boolean(linkFlow)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={cancelLinkFlow}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.reauthKeyboard}>
          <ScrollView style={styles.reauthScroll} contentContainerStyle={[styles.reauthBackdrop, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.reauthCard}>
              <View style={styles.reauthIconWrap}>
                <Ionicons name={linkFlow?.stage === 'reauthentication' ? 'shield-checkmark-outline' : 'link-outline'} size={24} color={theme.colors.primaryDark} />
              </View>
              <Text style={styles.reauthTitle}>
                {linkFlow?.stage === 'reauthentication' ? 'Confirm it’s you' : `Link ${socialProviderLabels[linkFlow?.targetProvider]}`}
              </Text>
              <Text style={styles.reauthText}>
                {linkFlow?.stage === 'reauthentication'
                  ? `Confirm your account before connecting ${socialProviderLabels[linkFlow?.targetProvider]}. This check expires shortly.`
                  : `Security check complete. Continue with ${socialProviderLabels[linkFlow?.targetProvider]} to prove you control the account you are linking.`}
              </Text>

              {linkFlow?.stage === 'reauthentication' ? (
                <View style={styles.reauthForm}>
                  {passwordAvailable ? (
                    <>
                      <Input
                        label="Current password"
                        value={reauthPassword}
                        onChangeText={setReauthPassword}
                        placeholder="Enter your password"
                        autoCapitalize="none"
                        autoComplete="current-password"
                        secureTextEntry
                        textContentType="password"
                        disabled={reauthLoading}
                        containerStyle={styles.reauthInput}
                      />
                      {mfaRequired ? (
                        <Input
                          label="Authenticator or recovery code"
                          value={mfaCode}
                          onChangeText={setMfaCode}
                          placeholder="Enter your code"
                          autoCapitalize="characters"
                          autoComplete="one-time-code"
                          secureTextEntry
                          textContentType="oneTimeCode"
                          disabled={reauthLoading}
                          containerStyle={styles.reauthInput}
                        />
                      ) : null}
                      <Button
                        title="Verify and continue"
                        onPress={() => completeReauthentication('password')}
                        loading={reauthLoading && reauthenticationMethod === 'password'}
                        disabled={reauthLoading}
                        fullWidth
                        style={styles.reauthPrimaryButton}
                      />
                      {reauthenticationProviders.length && !(reauthLoading && reauthenticationMethod === 'password') ? (
                        <View style={styles.reauthAlternative}>
                          <View style={styles.reauthDivider}>
                            <View style={styles.reauthDividerLine} />
                            <Text style={styles.reauthDividerText}>OR</Text>
                            <View style={styles.reauthDividerLine} />
                          </View>
                          <Text style={styles.reauthAlternativeText}>Verify with an already linked sign-in method instead.</Text>
                          {renderReauthenticationProviderOptions()}
                        </View>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <Text style={styles.reauthMethodText}>This account has no password. Verify with a sign-in method that is already linked to it.</Text>
                      {mfaRequired ? (
                        <Input
                          label="Authenticator or recovery code"
                          value={mfaCode}
                          onChangeText={setMfaCode}
                          placeholder="Enter your code"
                          autoCapitalize="characters"
                          autoComplete="one-time-code"
                          secureTextEntry
                          textContentType="oneTimeCode"
                          disabled={reauthLoading}
                          containerStyle={styles.reauthInput}
                        />
                      ) : null}
                      {renderReauthenticationProviderOptions()}
                    </>
                  )}
                </View>
              ) : (
                <View style={styles.reauthForm}>
                  {targetLinkLoading ? (
                    <View style={styles.reauthWorking}>
                      <ActivityIndicator color={theme.colors.primaryDark} size="small" />
                      <Text style={styles.reauthWorkingText}>Linking your account…</Text>
                    </View>
                  ) : linkFlow?.targetProvider === 'apple' ? (
                    <View style={styles.reauthAppleButtonWrap}>
                      <AppleAuthentication.AppleAuthenticationButton
                        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                        buttonStyle={(theme.dark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK)}
                        cornerRadius={12}
                        onPress={completeLinkIdentity}
                        style={styles.reauthAppleButton}
                      />
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Continue with Google to link your account"
                      onPress={completeLinkIdentity}
                      style={({ pressed }) => [styles.reauthGoogleButton, pressed && styles.reauthGoogleButtonPressed]}
                    >
                      <Ionicons name="logo-google" size={18} color="#4285F4" />
                      <Text style={styles.reauthGoogleButtonText}>Continue with Google</Text>
                    </Pressable>
                  )}
                </View>
              )}

              {linkFlowError ? <Text style={styles.reauthError}>{linkFlowError}</Text> : null}
              <Pressable
                accessibilityRole="button"
                disabled={reauthLoading || targetLinkLoading}
                onPress={cancelLinkFlow}
                style={({ pressed }) => [styles.reauthCancel, (reauthLoading || targetLinkLoading) && styles.reauthCancelDisabled, pressed && !reauthLoading && !targetLinkLoading && styles.reauthCancelPressed]}
              >
                <Text style={styles.reauthCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: { backgroundColor: theme.colors.background, flex: 1 },
  content: { paddingHorizontal: theme.spacing.lg },
  title: { color: theme.colors.text, fontSize: 32, fontWeight: '700', letterSpacing: -0.8, marginBottom: 24 },
  identityCard: { alignItems: 'center', flexDirection: 'row', marginBottom: 22 },
  avatar: { alignItems: 'center', backgroundColor: theme.colors.primaryLight, borderRadius: 28, height: 56, justifyContent: 'center', width: 56 },
  avatarText: { color: theme.colors.primaryDark, fontSize: 20, fontWeight: '600' },
  identityCopy: { flex: 1, marginLeft: 14 },
  userName: { color: theme.colors.text, fontSize: 19, fontWeight: '600' },
  userEmail: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 4 },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, minHeight: 24 },
  sectionLabel: { color: theme.colors.textSecondary, flexShrink: 1, fontSize: 13, fontWeight: '500', lineHeight: 19, marginLeft: 3 },
  preferencesLabel: { marginBottom: 8, marginTop: 24 },
  signInMethodsDetails: { borderTopColor: theme.colors.border.light, borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: 8 },
  signInMethodsIntro: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18, paddingBottom: 8, paddingTop: 12 },
  signInMethodRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 68, paddingVertical: 8 },
  signInMethodLeading: { alignItems: 'center', flex: 1, flexDirection: 'row', marginRight: 8 },
  signInMethodIcon: { alignItems: 'center', backgroundColor: theme.colors.surfaceSubtle, borderRadius: 11, height: 36, justifyContent: 'center', width: 36 },
  signInMethodCopy: { flex: 1, marginLeft: 9 },
  signInMethodTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '500' },
  signInMethodStatus: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
  connectedBadge: { alignItems: 'center', flexDirection: 'row', paddingHorizontal: 4, paddingVertical: 8 },
  connectedBadgeText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '500', marginLeft: 4 },
  linkButton: { alignItems: 'center', backgroundColor: theme.colors.primaryLight, borderRadius: 12, justifyContent: 'center', minHeight: 44, minWidth: 62, paddingHorizontal: 12 },
  linkButtonPressed: { opacity: 0.72 },
  linkButtonText: { color: theme.colors.primaryDark, fontSize: 13, fontWeight: '600' },
  appleLinkButtonWrap: { height: 44, width: 114 },
  appleLinkButton: { height: 44, width: 114 },
  identityLoading: { alignItems: 'center', flexDirection: 'row', paddingVertical: 16 },
  identityLoadingText: { color: theme.colors.textSecondary, flex: 1, fontSize: 12, marginLeft: 8 },
  identityError: { paddingBottom: 8 },
  identityErrorText: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18 },
  identityEmptyText: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18, paddingBottom: 12 },
  reauthKeyboard: { flex: 1 },
  reauthScroll: { flex: 1 },
  reauthBackdrop: { alignItems: 'center', backgroundColor: theme.colors.backdrop, flexGrow: 1, justifyContent: 'center', paddingHorizontal: theme.spacing.lg },
  reauthCard: { backgroundColor: theme.colors.surface, borderRadius: 28, maxWidth: 390, padding: 22, width: '100%', ...theme.shadows.large },
  reauthIconWrap: { alignItems: 'center', alignSelf: 'center', backgroundColor: theme.colors.primaryLight, borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  reauthTitle: { color: theme.colors.text, fontSize: 22, fontWeight: '600', marginTop: 16, textAlign: 'center' },
  reauthText: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 7, textAlign: 'center' },
  reauthForm: { marginTop: 20 },
  reauthInput: { marginBottom: 8 },
  reauthPrimaryButton: { marginTop: 4 },
  reauthAlternative: { marginTop: 16 },
  reauthDivider: { alignItems: 'center', flexDirection: 'row', marginBottom: 10 },
  reauthDividerLine: { backgroundColor: theme.colors.border.light, flex: 1, height: StyleSheet.hairlineWidth },
  reauthDividerText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '500', marginHorizontal: 8 },
  reauthAlternativeText: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 10, textAlign: 'center' },
  reauthMethodText: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  reauthGoogleButton: { alignItems: 'center', backgroundColor: theme.colors.surface, borderColor: theme.colors.border.medium, borderRadius: 16, borderWidth: 1, flexDirection: 'row', minHeight: 50, justifyContent: 'center', paddingHorizontal: 16 },
  reauthGoogleButtonPressed: { opacity: 0.76 },
  reauthGoogleButtonText: { color: theme.colors.text, fontSize: 14, fontWeight: '600', marginLeft: 10 },
  reauthAppleButtonWrap: { height: 50 },
  reauthAppleButton: { height: 50, width: '100%' },
  reauthProviderSpacer: { marginTop: 8 },
  reauthWorking: { alignItems: 'center', backgroundColor: theme.colors.primaryLight, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', minHeight: 50, paddingHorizontal: 16 },
  reauthWorkingText: { color: theme.colors.primaryDark, fontSize: 13, fontWeight: '500', marginLeft: 8 },
  reauthUnavailableText: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19 },
  reauthError: { color: theme.colors.error, fontSize: 12, lineHeight: 18, marginTop: 16, textAlign: 'center' },
  reauthCancel: { alignItems: 'center', marginTop: 12, minHeight: 44, justifyContent: 'center' },
  reauthCancelDisabled: { opacity: 0.45 },
  reauthCancelPressed: { opacity: 0.72 },
  reauthCancelText: { color: theme.colors.textSecondary, fontSize: 14, fontWeight: '500' },
  impactSyncWarning: { color: theme.colors.warning, fontSize: 12, lineHeight: 18, marginBottom: 8 },
  statsCard: { backgroundColor: theme.colors.surface, borderRadius: 22, flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden', paddingVertical: 8 },
  stat: { justifyContent: 'center', minHeight: 80, paddingHorizontal: 18, paddingVertical: 10, width: '50%' },
  statRightBorder: { borderRightColor: theme.colors.border.light, borderRightWidth: StyleSheet.hairlineWidth },
  statValue: { color: theme.colors.text, fontSize: 27, fontWeight: '600', letterSpacing: -0.6 },
  statLabel: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 4 },
  impactHelp: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 5 },
  impactHelpText: { color: theme.colors.primaryDark, fontSize: 12, fontWeight: '500' },
  impactStatusCard: { alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 20, flexDirection: 'row', padding: 17 },
  impactStatusIcon: { alignItems: 'center', backgroundColor: theme.colors.primaryLight, borderRadius: 18, height: 36, justifyContent: 'center', marginRight: 10, width: 36 },
  impactStatusCopy: { flex: 1 },
  impactStatusTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  impactStatusText: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 },
  impactLoadingText: { color: theme.colors.textSecondary, flex: 1, fontSize: 13, marginLeft: 10 },
  retryButton: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44, paddingHorizontal: 4 },
  retryButtonText: { color: theme.colors.primaryDark, fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: theme.colors.surface, borderRadius: 20, overflow: 'hidden', paddingHorizontal: 15 },
  rowBorder: { borderTopColor: theme.colors.border.light, borderTopWidth: StyleSheet.hairlineWidth },
  accountRow: { alignItems: 'center', flexDirection: 'row', minHeight: 57, paddingVertical: 10 },
  rowCopy: { flex: 1, marginHorizontal: 12 },
  rowTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '400', lineHeight: 21 },
  rowSubtitle: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 3 },
  signOutButton: { alignItems: 'center', alignSelf: 'center', justifyContent: 'center', marginTop: 22, minHeight: 44, minWidth: 100, paddingHorizontal: 12 },
  signOutText: { color: theme.colors.error, fontSize: 15, fontWeight: '500' },
});
