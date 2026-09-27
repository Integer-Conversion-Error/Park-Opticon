export const reconcileParkingSession = (storedSession, remoteState) => {
  if (remoteState?.active && remoteState.session) {
    const remote = remoteState.session;
    return {
      ...storedSession,
      id: remote.id,
      latitude: remote.latitude,
      longitude: remote.longitude,
      address: storedSession?.address || remote.address || 'Current location',
      startedAt: remote.started_at,
    };
  }
  // A UUID was synced previously. If the server has no active session now,
  // discard the stale private copy. Timestamp IDs belong to local-only starts.
  if (remoteState?.active === false && storedSession?.id?.includes('-')) return null;
  return storedSession || null;
};

export const resolveParkingSessionForEnd = async (session, shareOpenSpot, apiClient) => {
  if (session.id?.includes('-')) return session;

  const active = await apiClient.activeSession();
  if (active?.active && active.session?.id) return { ...session, id: active.session.id };
  if (!shareOpenSpot) return session;

  try {
    const created = await apiClient.startSession({
      latitude: session.latitude,
      longitude: session.longitude,
      address: session.address,
    });
    return { ...session, id: created.id };
  } catch (error) {
    // The original start can race this recovery attempt. A conflict means it
    // reached the server; use that active session rather than leaving it open.
    if (error?.status !== 409) throw error;
    const raced = await apiClient.activeSession();
    if (!raced?.active || !raced.session?.id) throw error;
    return { ...session, id: raced.session.id };
  }
};
