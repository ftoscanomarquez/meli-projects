/**
 * Heurística de moderación del chat en vivo — pedido explícito del usuario
 * (2026-07-22, ver AGENTS.md §6.6): "cualquier indicio de que suceda que
 * pongan en riesgos a los jugadores o se vea una especie de acoso deben
 * marcarse como conversaciones prioritarias a revisar". Esto NO bloquea ni
 * censura mensajes — el chat sigue funcionando en vivo sin fricción; solo
 * marca (`flagged`) el mensaje ya guardado en Mongo para que aparezca
 * primero en el panel de moderación del admin (AdminChatPanel). La revisión
 * y la decisión de amonestar siguen siendo 100% humanas (ver lib/reports.ts).
 */

// 7+ dígitos consecutivos (con separadores opcionales de espacio/guion/punto)
// — patrón típico de un número telefónico mexicano/internacional.
const PHONE_REGEX = /\d[\d\s.-]{6,}\d/;

const ADDRESS_KEYWORDS = [
  "direccion",
  "dirección",
  "domicilio",
  "codigo postal",
  "código postal",
  "vivo en",
  "mi casa",
  "mi calle",
  "colonia",
];

const CONTACT_REQUEST_KEYWORDS = [
  "whatsapp",
  "telegram",
  "instagram",
  "facebook",
  "tiktok",
  "numero de telefono",
  "número de teléfono",
  "tu numero",
  "tu número",
  "llamame",
  "llámame",
  "agregame",
  "agrégame",
];

// Lista básica, no exhaustiva a propósito — el objetivo es priorizar la
// revisión humana, no censurar automáticamente (ver comentario de arriba).
const PROFANITY_KEYWORDS = [
  "pendejo",
  "pendeja",
  "puto",
  "puta",
  "idiota",
  "estupido",
  "estúpido",
  "imbecil",
  "imbécil",
  "cabron",
  "cabrón",
  "verga",
  "mierda",
];

export type ModerationResult = { flagged: boolean; reasons: string[] };

export function evaluateMessage(text: string): ModerationResult {
  const normalized = text.toLowerCase();
  const reasons: string[] = [];

  if (PHONE_REGEX.test(normalized)) reasons.push("possible_phone_number");
  if (ADDRESS_KEYWORDS.some((k) => normalized.includes(k))) reasons.push("possible_address");
  if (CONTACT_REQUEST_KEYWORDS.some((k) => normalized.includes(k))) reasons.push("contact_request");
  if (PROFANITY_KEYWORDS.some((k) => normalized.includes(k))) reasons.push("profanity");

  return { flagged: reasons.length > 0, reasons };
}
