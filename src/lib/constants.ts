export const PLATFORM_FEE_RATE = 0.1;
export const POLICY_VERSION = "2026-10";
export const APP_NAME = "Oficio";

export const CATEGORIES = [
  { id: "plomeria", name: "Plomería", blurb: "Fugas, llaves, drenaje y tinacos", icon: "droplets", sort: 1 },
  { id: "electricidad", name: "Electricidad", blurb: "Contactos, apagones y lámparas", icon: "zap", sort: 2 },
  { id: "carpinteria", name: "Carpintería", blurb: "Puertas, closets y muebles", icon: "hammer", sort: 3 },
  { id: "pintura", name: "Pintura", blurb: "Muros, techos y retoques", icon: "paintbrush", sort: 4 },
  { id: "tecnico", name: "Técnicos", blurb: "Clima, lavadora, boiler y estufa", icon: "wrench", sort: 5 },
  { id: "jardineria", name: "Jardinería", blurb: "Pasto, plantas y poda", icon: "flower", sort: 6 },
  { id: "limpieza", name: "Limpieza", blurb: "Hogar, mudanza y profundo", icon: "sparkles", sort: 7 },
  { id: "cerrajeria", name: "Cerrajería", blurb: "Chapas, llaves y emergencias", icon: "key", sort: 8 },
  { id: "albanileria", name: "Albañilería", blurb: "Humedad, pisos y resanes", icon: "brick", sort: 9 },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const PROBLEM_HINTS: { words: string[]; categoryId: CategoryId }[] = [
  { words: ["fuga", "goteo", "llave", "tuber", "drenaje", "tapon", "wc", "bano", "tinaco", "boiler de agua"], categoryId: "plomeria" },
  { words: ["corto", "apagon", "contacto", "enchufe", "luz", "pastilla", "cable"], categoryId: "electricidad" },
  { words: ["puerta", "closet", "mueble", "madera", "cajon"], categoryId: "carpinteria" },
  { words: ["pintar", "pintura", "muro", "humedad de pintura"], categoryId: "pintura" },
  { words: ["clima", "minisplit", "lavadora", "estufa", "refrigerador", "boiler"], categoryId: "tecnico" },
  { words: ["jardin", "pasto", "poda", "plantas"], categoryId: "jardineria" },
  { words: ["limpieza", "lavar", "mudanza"], categoryId: "limpieza" },
  { words: ["chapa", "llave", "cerradura", "candado"], categoryId: "cerrajeria" },
  { words: ["azotea", "piso", "tabique", "resane", "humedad"], categoryId: "albanileria" },
];

export const DAY_KEYS = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"] as const;

export const DAY_LABELS: Record<(typeof DAY_KEYS)[number], string> = {
  lun: "Lunes",
  mar: "Martes",
  mie: "Miércoles",
  jue: "Jueves",
  vie: "Viernes",
  sab: "Sábado",
  dom: "Domingo",
};

export const DEFAULT_SCHEDULE: Record<(typeof DAY_KEYS)[number], string> = {
  lun: "09:00–18:00",
  mar: "09:00–18:00",
  mie: "09:00–18:00",
  jue: "09:00–18:00",
  vie: "09:00–18:00",
  sab: "09:00–14:00",
  dom: "Cerrado",
};

export const STATUS_ORDER = [
  "REQUESTED",
  "QUOTED",
  "CONFIRMED",
  "EN_ROUTE",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

export const STATUS_LABEL: Record<string, string> = {
  REQUESTED: "Solicitado",
  QUOTED: "Cotizado",
  CONFIRMED: "Confirmado",
  EN_ROUTE: "Proveedor en camino",
  IN_PROGRESS: "En proceso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

export const NEXT_STATUS: Record<string, string | undefined> = {
  CONFIRMED: "EN_ROUTE",
  EN_ROUTE: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
};

export const ADVANCE_LABEL: Record<string, string> = {
  EN_ROUTE: "Ya voy en camino",
  IN_PROGRESS: "Ya empecé el trabajo",
  COMPLETED: "Marcar como terminado",
};

export type PaymentMethodId = "CARD" | "OXXO" | "SPEI" | "MP" | "CASH";

export const PAYMENT_METHODS: {
  id: PaymentMethodId;
  name: string;
  summary: string;
  protection: string;
  external: string;
}[] = [
  {
    id: "CARD",
    name: "Tarjeta",
    summary: "Débito o crédito",
    protection:
      "En esta demo no se hace ningún cargo a una tarjeta. En producción aquí se conectaría Conekta, Stripe México, Mercado Pago u OpenPay. Oficio no retiene el dinero y no hay depósito en garantía. Sí queda un recibo de lo que elegiste y puedes abrir una aclaración.",
    external: "Conekta, Stripe México, Mercado Pago u OpenPay",
  },
  {
    id: "OXXO",
    name: "OXXO",
    summary: "Pago en tienda",
    protection:
      "Simulado / Demo: no generamos una ficha de OXXO ni un código de barras real. En producción, Conekta, OpenPay o Mercado Pago crearían la ficha para pagar en tienda. Aquí solo anotamos que elegiste OXXO. No hay cobro ni custodia de fondos.",
    external: "Conekta, OpenPay o Mercado Pago (ficha OXXO)",
  },
  {
    id: "SPEI",
    name: "SPEI",
    summary: "Transferencia",
    protection:
      "Simulado / Demo: no hay CLABE ni referencia bancaria real. No transfieras dinero a nadie por este concepto dentro de la app. En producción, la pasarela generaría la referencia SPEI. Oficio no custodia ese dinero.",
    external: "Conekta, OpenPay, Stripe México o Mercado Pago (SPEI)",
  },
  {
    id: "MP",
    name: "Mercado Pago",
    summary: "Saldo o tarjeta en Mercado Pago",
    protection:
      "Simulado / Demo: no abrimos el checkout de Mercado Pago ni se mueve saldo. Falta conectar su API. No hay cobro ni dinero retenido por Oficio.",
    external: "Mercado Pago Checkout",
  },
  {
    id: "CASH",
    name: "Efectivo",
    summary: "Se lo pagas al proveedor",
    protection:
      "Pagas directo al proveedor, en efectivo, como acuerden. Oficio no toca ese dinero, no lo retiene y no puede devolverlo. La comisión de la plataforma no se cobra en esta demo. Si algo sale mal, abre una aclaración: una persona la revisa con los dos. No hay reembolso automático.",
    external: "Ninguno: el efectivo no pasa por Oficio",
  },
];

export const CANCELLATION_RULES = [
  "Antes de confirmar la cita y el método de pago, puedes cancelar sin costo.",
  "Después de confirmar, también puedes cancelar. En esta demo no existe un cargo real que haya que devolver.",
  "Si el proveedor ya va en camino o el trabajo empezó, la cancelación abre una aclaración para que administración la revise.",
  "En efectivo, el dinero se lo das al proveedor. Oficio no lo guarda y no lo regresa.",
  "No hay depósito en garantía ni custodia de fondos. Una aclaración es una revisión entre las dos personas, no un reembolso automático.",
];

export const TRUST_LINES = [
  {
    key: "identity",
    on: "Identidad verificada",
    off: "Identidad sin verificar",
    help: "Una persona del equipo revisó una identificación. Si no ves la etiqueta verde, nadie la ha marcado.",
  },
  {
    key: "cert",
    on: "Certificaciones revisadas",
    off: "Certificaciones sin revisar",
    help: "El equipo vio un documento del oficio. No significa un título universitario ni una licencia automática.",
  },
  {
    key: "references",
    on: "Referencias revisadas",
    declared: "Referencias declaradas (sin revisar)",
    off: "Sin referencias revisadas",
    help: "Lo que el proveedor cuenta de clientes anteriores. «Revisadas» solo si el equipo las confirmó.",
  },
] as const;

export const INTEGRATIONS = [
  {
    id: "pagos",
    name: "Pagos",
    needed: "Conekta, Stripe México, Mercado Pago u OpenPay",
    now: "Se registra el método y el desglose. No hay cobro, ficha de OXXO, CLABE ni checkout.",
  },
  {
    id: "mapas",
    name: "Mapas y códigos postales",
    needed: "Google Maps Geocoding o Mapbox, más el mapa para mover el pin",
    now: "Directorio local de algunos códigos de ejemplo y un mapa ilustrado.",
  },
  {
    id: "sms",
    name: "SMS y correo de acceso",
    needed: "Twilio, MessageBird u otro SMS en México, y un correo transaccional",
    now: "El código aparece en la pantalla. No se envía.",
  },
  {
    id: "google",
    name: "Google",
    needed: "Cliente OAuth de Google Cloud y URL de retorno",
    now: "Un botón entra a una cuenta demo fija. No abre Google.",
  },
  {
    id: "identidad",
    name: "Verificación de identidad",
    needed: "Un proveedor que revise INE u otra identificación",
    now: "La persona administradora marca la revisión dentro de Oficio. Nada se aprueba solo.",
  },
  {
    id: "avisos",
    name: "Avisos en el celular",
    needed: "Notificaciones push (FCM o APNs) cuando exista la app nativa",
    now: "Avisos dentro de la app, al abrirla.",
  },
] as const;

export const POSTAL_DIRECTORY = [
  { cp: "06700", neighborhood: "Roma Norte", city: "Ciudad de México", state: "CDMX", lat: 19.4194, lng: -99.1622 },
  { cp: "06760", neighborhood: "Roma Sur", city: "Ciudad de México", state: "CDMX", lat: 19.4065, lng: -99.1638 },
  { cp: "06140", neighborhood: "Condesa", city: "Ciudad de México", state: "CDMX", lat: 19.4126, lng: -99.1734 },
  { cp: "03100", neighborhood: "Del Valle Centro", city: "Ciudad de México", state: "CDMX", lat: 19.3895, lng: -99.1648 },
  { cp: "03020", neighborhood: "Narvarte Poniente", city: "Ciudad de México", state: "CDMX", lat: 19.3978, lng: -99.1559 },
  { cp: "11800", neighborhood: "Escandón", city: "Ciudad de México", state: "CDMX", lat: 19.4028, lng: -99.1786 },
  { cp: "04000", neighborhood: "Coyoacán", city: "Ciudad de México", state: "CDMX", lat: 19.3505, lng: -99.1625 },
  { cp: "06600", neighborhood: "Juárez", city: "Ciudad de México", state: "CDMX", lat: 19.427, lng: -99.159 },
  { cp: "06040", neighborhood: "Centro", city: "Ciudad de México", state: "CDMX", lat: 19.4326, lng: -99.1332 },
  { cp: "06720", neighborhood: "Doctores", city: "Ciudad de México", state: "CDMX", lat: 19.4132, lng: -99.1435 },
  { cp: "44100", neighborhood: "Americana", city: "Guadalajara", state: "Jalisco", lat: 20.6748, lng: -103.3685 },
  { cp: "64000", neighborhood: "Centro", city: "Monterrey", state: "Nuevo León", lat: 25.6714, lng: -100.309 },
] as const;

export function breakdown(serviceMxn: number) {
  const feeMxn = Math.round(serviceMxn * PLATFORM_FEE_RATE);
  return {
    serviceMxn,
    feeMxn,
    totalMxn: serviceMxn + feeMxn,
    rate: PLATFORM_FEE_RATE,
  };
}

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

export function normalizePhone(input: string) {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("521")) digits = digits.slice(3);
  if (digits.length === 12 && digits.startsWith("52")) digits = digits.slice(2);
  return digits;
}
