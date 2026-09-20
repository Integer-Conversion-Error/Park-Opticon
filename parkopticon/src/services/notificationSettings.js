export const DEFAULT_NOTIFICATION_RADIUS_METERS = 1000;
export const MAX_NOTIFICATION_RADIUS_METERS = 1500;
export const NOTIFICATION_RADIUS_OPTIONS = [100, 250, 500, 750, 1000, 1250, 1500];

export const normalizeNotificationRadius = (value) => (
  Number.isFinite(value)
    ? Math.min(MAX_NOTIFICATION_RADIUS_METERS, Math.max(100, Math.round(value)))
    : DEFAULT_NOTIFICATION_RADIUS_METERS
);
