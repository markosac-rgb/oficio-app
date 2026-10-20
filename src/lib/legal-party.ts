/**
 * Únicos datos del responsable. Si cambian, se actualizan aquí.
 * docs/legal/*.md puede seguir usando los marcadores [RAZÓN SOCIAL…];
 * las páginas y el aviso simplificado los sustituyen con estos valores.
 */
export const LEGAL_PARTY = {
  name: "Marcos Iván Amezquita Canizales (persona física)",
  address: "Circuito Berrugata 3303, Palmilla",
  rfc: "AECM880617U33",
  privacyEmail: "xionplanta@gmail.com",
  updatedAt: "20 de octubre de 2026",
} as const;

const LEGAL_PLACEHOLDERS: Record<string, string> = {
  "[RAZÓN SOCIAL O NOMBRE DEL RESPONSABLE]": LEGAL_PARTY.name,
  "[DOMICILIO]": LEGAL_PARTY.address,
  "[RFC]": LEGAL_PARTY.rfc,
  "[CORREO DE CONTACTO DE PRIVACIDAD]": LEGAL_PARTY.privacyEmail,
  "[FECHA DE ÚLTIMA ACTUALIZACIÓN]": LEGAL_PARTY.updatedAt,
};

export function applyLegalParty(text: string) {
  return Object.entries(LEGAL_PLACEHOLDERS).reduce((result, [token, value]) => result.split(token).join(value), text);
}
