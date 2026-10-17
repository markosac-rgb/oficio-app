export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const earth = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

/** About 1 km. Used before a job is confirmed so the pin is not the doorway. */
export function fuzzyCoord(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatDistance(km: number | null) {
  if (km == null) return "Distancia por definir";
  if (km < 1) return "A menos de 1 km";
  return `A ${km.toFixed(km < 10 ? 1 : 0)} km`;
}
