function normalizeVehicleNumber(value) {
  if (value == null) return "";
  return String(value).replace(/\s+/g, "").toUpperCase().trim();
}

function pad4(n) {
  const s = String(n);
  return s.padStart(4, "0").slice(-4);
}

function extractVehicleSuffix(normalizedVehicleNumber) {
  const v = normalizeVehicleNumber(normalizedVehicleNumber);
  if (!v) return "";

  // If it's just digits (e.g. 28, 0028, 6729)
  if (/^\d+$/.test(v)) return pad4(v);

  // Prefer last 4-digit sequence anywhere in the string (e.g. JH05AC0028 -> 0028)
  const all4 = v.match(/\d{4}/g);
  if (all4 && all4.length > 0) return all4[all4.length - 1];

  // Special case: digits at the front like 6285AG
  const front4 = v.match(/^(\d{4})/);
  if (front4) return front4[1];

  // Fallback: any digits, take last up to 4
  const digits = v.match(/\d+/g);
  if (digits && digits.length > 0) {
    return pad4(digits[digits.length - 1]);
  }

  return "";
}

export function normalizeVehicle(value) {
  const vehicleNumber = normalizeVehicleNumber(value);
  const vehicleSuffix = extractVehicleSuffix(vehicleNumber);
  return { vehicleNumber, vehicleSuffix };
}
