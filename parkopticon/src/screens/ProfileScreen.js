import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { theme } from '../theme';
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
          <ActivityIndicator color={theme.colors.primary} size="small" />
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
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
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

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Your account</Text>

      <View style={styles.identityCard}>
        <View style={styles.identityTopRow}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{guestMode ? 'G' : getInitials(displayName)}</Text></View>
          <View style={styles.identityCopy}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userEmail}>{displayEmail}</Text>
          </View>
          <View style={styles.memberBadge}><Text style={styles.memberBadgeText}>{guestMode ? 'GUEST' : 'MEMBER'}</Text></View>
        </View>
        <View style={styles.identityDivider} />
        <Text style={styles.identityHint}>{guestMode ? 'Guest reports and settings stay on this device until you sign in.' : 'Your contribution helps drivers make faster, safer parking decisions.'}</Text>
      </View>

      {!guestMode ? (
        <>
          <Text style={styles.sectionLabel}>SIGN-IN METHODS</Text>
          <View style={styles.signInMethodsCard}>
            <Text style={styles.signInMethodsIntro}>Link a provider you own to use it for future sign-ins. We never receive your provider password.</Text>
            {identitiesLoading ? (
              <View style={styles.identityLoading}>
                <ActivityIndicator color={theme.colors.primary} />
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
                    <ActivityIndicator color={theme.colors.primary} size="small" />
                  ) : provider.provider === 'apple' ? (
                    <View pointerEvents={linkingProvider ? 'none' : 'auto'} style={styles.appleLinkButtonWrap}>
                      <AppleAuthentication.AppleAuthenticationButton
                        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
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
        </>
      ) : null}

      <Text style={styles.sectionLabel}>COMMUNITY IMPACT</Text>
      {guestMode ? (
        <View style={styles.impactStatusCard}>
          <View style={styles.impactStatusIcon}><Ionicons name="person-outline" size={20} color={theme.colors.primary} /></View>
          <View style={styles.impactStatusCopy}>
            <Text style={styles.impactStatusTitle}>Sign in to track your impact</Text>
            <Text style={styles.impactStatusText}>Guest reports stay on this device, so they are not presented as live community metrics.</Text>
          </View>
        </View>
      ) : impactLoading && !impact ? (
        <View style={styles.impactStatusCard}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.impactLoadingText}>Loading your community activity…</Text>
        </View>
      ) : impact && hasCommunityActivity ? (
        <>
          <Text style={styles.impactIntro}>A record of what you shared, checked, and helped surface—not a reputation score.</Text>
          {impactError ? <Text style={styles.impactSyncWarning}>Could not refresh. Showing the last loaded activity.</Text> : null}
          <View style={styles.statsCard}>
            {impactMetrics.map((metric, index) => (
              <View
                key={metric.label}
                style={[
                  styles.stat,
                  index % 2 === 0 && styles.statRightBorder,
                  index >= 2 && styles.statTopBorder,
                ]}
              >
                <View style={styles.statHeading}>
                  <Ionicons name={metric.icon} size={16} color={theme.colors.primary} />
                  <Text style={styles.statValue}>{formatCount(metric.value)}</Text>
                </View>
                <Text style={styles.statLabel}>{metric.label}</Text>
                <Text style={styles.statDetail}>{metric.detail}</Text>
              </View>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Learn how community impact is counted"
            onPress={() => showModal(
              'How impact is counted',
              'Reports shared are your open-spot shares and original enforcement alerts. A report is confirmed when another driver confirms it. Reports checked are your current confirmations or corrections. Drivers alerted counts unique other accounts for which Parkopticon created an enforcement notification from one of your original alerts; it is not a delivery or read count.',
            )}
            style={styles.impactHelp}
          >
            <Ionicons name="information-circle-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.impactHelpText}>How these are counted</Text>
          </Pressable>
        </>
      ) : impact ? (
        <View style={styles.impactStatusCard}>
          <View style={styles.impactStatusIcon}><Ionicons name="pulse-outline" size={20} color={theme.colors.primary} /></View>
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

      <Text style={styles.sectionLabel}>PREFERENCES</Text>
      <View style={styles.card}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notification controls"
          onPress={() => navigation.navigate('Settings')}
          style={styles.accountRow}
        >
          <View style={styles.rowIcon}><Ionicons name="notifications-outline" size={21} color={theme.colors.primary} /></View>
          <View style={styles.rowCopy}><Text style={styles.rowTitle}>Notification controls</Text><Text style={styles.rowSubtitle}>Alerts, radius, and privacy</Text></View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </Pressable>
      </View>

      <Pressable onPress={() => showModal(guestMode ? 'Leave guest mode' : 'Sign out', guestMode ? 'Return to the sign-in screen? Local guest data will remain on this device.' : 'Sign out of this device?', [{ text: 'Cancel', style: 'cancel' }, { text: guestMode ? 'Continue' : 'Sign out', style: 'destructive', onPress: signOut }])} style={styles.signOutButton}>
        <Ionicons name="log-out-outline" size={18} color={theme.colors.error} />
        <Text style={styles.signOutText}>{guestMode ? 'Leave guest mode' : 'Sign out'}</Text>
      </Pressable>
      <View style={styles.footerRow}>
        <Text style={styles.version}>PARKOPTICON · V1.0.0</Text>
        <Text style={styles.footerDivider}> · </Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Email Parkopticon support"
          accessibilityHint="Opens an email with the Parkopticon subject prefix"
          onPress={openSupportEmail}
        >
          <Text style={styles.supportFooterLink}>SUPPORT</Text>
        </Pressable>
      </View>
      </ScrollView>

      <Modal
        visible={Boolean(linkFlow)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={cancelLinkFlow}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.reauthKeyboard}>
          <ScrollView style={styles.reauthScroll} contentContainerStyle={styles.reauthBackdrop} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.reauthCard}>
              <View style={styles.reauthIconWrap}>
                <Ionicons name={linkFlow?.stage === 'reauthentication' ? 'shield-checkmark-outline' : 'link-outline'} size={24} color={theme.colors.primary} />
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
                      <ActivityIndicator color={theme.colors.primary} size="small" />
                      <Text style={styles.reauthWorkingText}>Linking your account…</Text>
                    </View>
                  ) : linkFlow?.targetProvider === 'apple' ? (
                    <View style={styles.reauthAppleButtonWrap}>
                      <AppleAuthentication.AppleAuthenticationButton
                        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
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

const styles = StyleSheet.create({
  container: { backgroundColor: theme.colors.background, flex: 1 },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  title: { color: theme.colors.text, fontSize: 27, fontWeight: '800' },
  identityCard: { backgroundColor: '#102A36', borderRadius: 16, marginTop: theme.spacing.lg, padding: theme.spacing.lg, ...theme.shadows.medium },
  identityTopRow: { alignItems: 'center', flexDirection: 'row' },
  avatar: { alignItems: 'center', backgroundColor: '#DDF3F4', borderRadius: 26, height: 52, justifyContent: 'center', width: 52 },
  avatarText: { color: theme.colors.primaryDark, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  identityCopy: { flex: 1, marginLeft: theme.spacing.md },
  userName: { color: theme.colors.white, fontSize: 17, fontWeight: '800' },
  userEmail: { color: '#AFC3CA', fontSize: 12, marginTop: 3 },
  memberBadge: { borderColor: '#55727C', borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5 },
  memberBadgeText: { color: '#D3E4E7', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  identityDivider: { backgroundColor: '#2B4651', height: 1, marginVertical: theme.spacing.md },
  identityHint: { color: '#BBD0D5', fontSize: 12, lineHeight: 18 },
  sectionLabel: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginTop: theme.spacing.lg },
  signInMethodsCard: { backgroundColor: theme.colors.white, borderColor: theme.colors.border.light, borderRadius: 14, borderWidth: 1, marginTop: theme.spacing.sm, overflow: 'hidden', paddingHorizontal: theme.spacing.md, ...theme.shadows.small },
  signInMethodsIntro: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 17, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.sm },
  signInMethodRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 66 },
  signInMethodLeading: { alignItems: 'center', flex: 1, flexDirection: 'row', marginRight: theme.spacing.sm },
  signInMethodIcon: { alignItems: 'center', backgroundColor: theme.colors.background, borderRadius: 10, height: 38, justifyContent: 'center', width: 38 },
  signInMethodCopy: { flex: 1, marginLeft: theme.spacing.sm },
  signInMethodTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
  signInMethodStatus: { color: theme.colors.textMuted, fontSize: 11, marginTop: 3 },
  connectedBadge: { alignItems: 'center', backgroundColor: theme.colors.primaryLight, borderRadius: 8, flexDirection: 'row', paddingHorizontal: 7, paddingVertical: 5 },
  connectedBadgeText: { color: theme.colors.primaryDark, fontSize: 10, fontWeight: '800', marginLeft: 3 },
  linkButton: { alignItems: 'center', borderColor: theme.colors.primary, borderRadius: 8, borderWidth: 1, justifyContent: 'center', minHeight: 34, minWidth: 58, paddingHorizontal: 10 },
  linkButtonPressed: { backgroundColor: theme.colors.primaryLight },
  linkButtonText: { color: theme.colors.primaryDark, fontSize: 12, fontWeight: '800' },
  appleLinkButtonWrap: { height: 34, width: 114 },
  appleLinkButton: { height: 34, width: 114 },
  identityLoading: { alignItems: 'center', flexDirection: 'row', paddingVertical: theme.spacing.md },
  identityLoadingText: { color: theme.colors.textSecondary, fontSize: 12, marginLeft: theme.spacing.sm },
  identityError: { paddingBottom: theme.spacing.md },
  identityErrorText: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 17 },
  identityEmptyText: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 17, paddingBottom: theme.spacing.md },
  reauthKeyboard: { flex: 1 },
  reauthScroll: { flex: 1 },
  reauthBackdrop: { alignItems: 'center', backgroundColor: 'rgba(18,35,45,0.48)', flexGrow: 1, justifyContent: 'center', padding: theme.spacing.lg },
  reauthCard: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border.light, borderRadius: theme.borderRadius.lg, borderWidth: 1, maxWidth: 390, padding: theme.spacing.lg, width: '100%', ...theme.shadows.large },
  reauthIconWrap: { alignItems: 'center', alignSelf: 'center', backgroundColor: theme.colors.primaryLight, borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  reauthTitle: { color: theme.colors.text, fontSize: 19, fontWeight: '800', marginTop: theme.spacing.md, textAlign: 'center' },
  reauthText: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: theme.spacing.xs, textAlign: 'center' },
  reauthForm: { marginTop: theme.spacing.lg },
  reauthInput: { marginBottom: theme.spacing.sm },
  reauthPrimaryButton: { marginTop: theme.spacing.xs },
  reauthAlternative: { marginTop: theme.spacing.md },
  reauthDivider: { alignItems: 'center', flexDirection: 'row', marginBottom: theme.spacing.sm },
  reauthDividerLine: { backgroundColor: theme.colors.border.light, flex: 1, height: 1 },
  reauthDividerText: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginHorizontal: theme.spacing.sm },
  reauthAlternativeText: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 17, marginBottom: theme.spacing.sm, textAlign: 'center' },
  reauthMethodText: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: theme.spacing.md },
  reauthGoogleButton: { alignItems: 'center', backgroundColor: theme.colors.white, borderColor: theme.colors.border.medium, borderRadius: 12, borderWidth: 1, flexDirection: 'row', height: 50, justifyContent: 'center', paddingHorizontal: theme.spacing.md },
  reauthGoogleButtonPressed: { opacity: 0.82 },
  reauthGoogleButtonText: { color: theme.colors.text, fontSize: 14, fontWeight: '700', marginLeft: 10 },
  reauthAppleButtonWrap: { height: 50 },
  reauthAppleButton: { height: 50, width: '100%' },
  reauthProviderSpacer: { marginTop: theme.spacing.sm },
  reauthWorking: { alignItems: 'center', backgroundColor: theme.colors.primaryLight, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', minHeight: 50, paddingHorizontal: theme.spacing.md },
  reauthWorkingText: { color: theme.colors.primaryDark, fontSize: 13, fontWeight: '700', marginLeft: theme.spacing.sm },
  reauthUnavailableText: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19 },
  reauthError: { color: theme.colors.error, fontSize: 12, lineHeight: 17, marginTop: theme.spacing.md, textAlign: 'center' },
  reauthCancel: { alignItems: 'center', marginTop: theme.spacing.md, minHeight: 38, justifyContent: 'center' },
  reauthCancelDisabled: { opacity: 0.45 },
  reauthCancelPressed: { opacity: 0.72 },
  reauthCancelText: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '700' },
  impactIntro: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: theme.spacing.xs },
  impactSyncWarning: { color: theme.colors.warning, fontSize: 11, lineHeight: 16, marginTop: 4 },
  statsCard: { backgroundColor: theme.colors.white, borderColor: theme.colors.border.light, borderRadius: 14, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', marginTop: theme.spacing.sm, overflow: 'hidden', ...theme.shadows.small },
  stat: { minHeight: 112, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, width: '50%' },
  statRightBorder: { borderRightColor: theme.colors.border.light, borderRightWidth: 1 },
  statTopBorder: { borderTopColor: theme.colors.border.light, borderTopWidth: 1 },
  statHeading: { alignItems: 'center', flexDirection: 'row' },
  statValue: { color: theme.colors.primaryDark, fontSize: 21, fontWeight: '800', marginLeft: 6 },
  statLabel: { color: theme.colors.text, fontSize: 11, fontWeight: '800', marginTop: 7 },
  statDetail: { color: theme.colors.textMuted, fontSize: 10, lineHeight: 14, marginTop: 3 },
  impactHelp: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', marginTop: theme.spacing.sm, paddingVertical: 4 },
  impactHelpText: { color: theme.colors.primary, fontSize: 12, fontWeight: '700', marginLeft: 5 },
  impactStatusCard: { alignItems: 'center', backgroundColor: theme.colors.white, borderColor: theme.colors.border.light, borderRadius: 14, borderWidth: 1, flexDirection: 'row', marginTop: theme.spacing.sm, padding: theme.spacing.md, ...theme.shadows.small },
  impactStatusIcon: { alignItems: 'center', backgroundColor: theme.colors.primaryLight, borderRadius: 18, height: 36, justifyContent: 'center', marginRight: theme.spacing.sm, width: 36 },
  impactStatusCopy: { flex: 1 },
  impactStatusTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '800' },
  impactStatusText: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
  impactLoadingText: { color: theme.colors.textSecondary, fontSize: 13, marginLeft: theme.spacing.sm },
  retryButton: { alignSelf: 'flex-start', marginTop: theme.spacing.sm, paddingVertical: 2 },
  retryButtonText: { color: theme.colors.primary, fontSize: 12, fontWeight: '800' },
  card: { backgroundColor: theme.colors.white, borderColor: theme.colors.border.light, borderRadius: 14, borderWidth: 1, marginTop: theme.spacing.sm, paddingHorizontal: theme.spacing.md, ...theme.shadows.small },
  rowBorder: { borderTopColor: theme.colors.border.light, borderTopWidth: 1 },
  accountRow: { alignItems: 'center', flexDirection: 'row', minHeight: 68 },
  rowIcon: { alignItems: 'center', backgroundColor: theme.colors.primaryLight, borderRadius: 10, height: 38, justifyContent: 'center', width: 38 },
  rowCopy: { flex: 1, marginLeft: theme.spacing.sm },
  rowTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
  rowSubtitle: { color: theme.colors.textMuted, fontSize: 12, marginTop: 3 },
  signOutButton: { alignItems: 'center', alignSelf: 'center', flexDirection: 'row', marginTop: theme.spacing.xl, padding: theme.spacing.sm },
  signOutText: { color: theme.colors.error, fontSize: 13, fontWeight: '700', marginLeft: 7 },
  footerRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: theme.spacing.sm },
  version: { color: theme.colors.textMuted, fontSize: 10, letterSpacing: 1 },
  footerDivider: { color: theme.colors.textMuted, fontSize: 10, letterSpacing: 1 },
  supportFooterLink: { color: theme.colors.primary, fontSize: 10, letterSpacing: 1 },
});
