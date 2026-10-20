import { applyLegalParty } from "@/lib/legal-party";

/** Texto corto del art. 16 de la LFPDPPP (aviso simplificado). También abre docs/legal/aviso-privacidad.md. */
export const DRAFT_BANNER = "Borrador — debe revisarlo un abogado antes de publicarse";

const SIMPLIFIED_TEMPLATE = [
  "Responsable: [RAZÓN SOCIAL O NOMBRE DEL RESPONSABLE], con domicilio en [DOMICILIO].",
  "Datos que se tratan: nombre, correo, teléfono, dirección y ubicación aproximada, perfil y oficio, reseñas, mensajes del chat, datos de identificación si se usa la verificación, y el registro del pago (monto, estado e identificador de Mercado Pago). El número de tarjeta y la CLABE los captura Mercado Pago, no Ofixio. Si se recaba la imagen o el número de una identificación oficial, ese dato se identifica como sensible en el aviso integral.",
  "Finalidades primarias, necesarias para darte el servicio: crear y administrar tu cuenta, contactarte, mostrar la zona aproximada, operar la solicitud y el chat, y registrar el medio de pago acordado. Estas finalidades no piden una autorización aparte.",
  "Finalidades secundarias, que sí requieren tu consentimiento y puedes rechazar: enviarte avisos de novedades de la plataforma y usar datos que te identifican para mejorar el producto. Si no marcas la casilla al registrarte, no las aplicamos. También puedes pedir que se limiten escribiendo a [CORREO DE CONTACTO DE PRIVACIDAD].",
  "Para limitar el uso o la divulgación de tus datos usa esa casilla, escribe al correo anterior o, si no quieres publicidad, inscríbete en el Registro Público de Usuarios (REUS) de la PROFECO.",
  "El aviso de privacidad integral está en la página Aviso de privacidad de esta aplicación.",
] as const;

export const SIMPLIFIED_NOTICE = SIMPLIFIED_TEMPLATE.map((paragraph) => applyLegalParty(paragraph));
