export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function requiredText(value: unknown, label: string, min: number, max: number) {
  const text = asText(value);
  if (text.length < min) {
    throw new HttpError(400, `Escribe ${label}.`);
  }
  if (text.length > max) {
    throw new HttpError(400, `${label} es muy largo.`);
  }
  return text;
}
