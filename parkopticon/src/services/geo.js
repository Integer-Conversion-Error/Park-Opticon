// Keep this limit aligned with the API's verification proximity check.
export const VERIFICATION_RADIUS_METERS = 300;

const validCoordinates = (point) => point
  && Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90
  && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180;

// Spherical distance for map display and local proximity checks. The server's
// PostGIS geography check remains authoritative for online verification.
const preciseDistanceMeters = (from, to) => {
  if (!validCoordinates(from) || !validCoordinates(to)) return null;
  const radians = Math.PI / 180;
  const latitudeDelta = (to.latitude - from.latitude) * radians;
  const longitudeDelta = (to.longitude - from.longitude) * radians;
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(from.latitude * radians) * Math.cos(to.latitude * radians)
      * Math.sin(longitudeDelta / 2) ** 2;
  // Floating-point error can put antipodal points just outside [0, 1].
  const clamped = Math.max(0, Math.min(1, a));
  return 6371000 * 2 * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped));
};

export const distanceMeters = (from, to) => {
  const distance = preciseDistanceMeters(from, to);
  return distance === null ? null : Math.round(distance);
};

export const canVerifyReport = (from, report) => {
  const distance = preciseDistanceMeters(from, report);
  // Compare before display rounding so 300.4 m is not accepted as 300 m.
  return distance !== null && distance <= VERIFICATION_RADIUS_METERS;
};
