export function mxn(amount: number) {
  const formatted = new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
  return `$${formatted}`;
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

export function displayName(name: string, full: boolean) {
  const parts = name.trim().split(/\s+/);
  if (full || parts.length < 2) return name.trim();
  return `${parts[0]} ${parts[1]!.charAt(0)}.`;
}

export function formatPhone(phone: string | null | undefined) {
  if (!phone) return "";
  if (phone.length === 10) {
    return `${phone.slice(0, 2)} ${phone.slice(2, 6)} ${phone.slice(6)}`;
  }
  return phone;
}

export function formatWhen(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDay(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function stars(rating: number | null) {
  if (rating == null) return "Sin reseñas";
  return rating.toFixed(1);
}
