import { logger } from "@/lib/logger";

/**
 * Envío de mensajes de WhatsApp — usado por la recuperación de cuenta (ver
 * AGENTS.md §6.7): "le mandará el nombre del correo a su número de celular"
 * vía WhatsApp. Implementa el contrato real de la WhatsApp Cloud API de
 * Meta (Graph API) — MISMA advertencia que Mailpit en AGENTS.md §6.1: sin
 * `WHATSAPP_API_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` reales (un número de
 * WhatsApp Business verificado en Meta for Developers), esta función NO
 * entrega mensajes de verdad — solo registra en el log que se habría
 * enviado, para no romper el flujo completo en desarrollo/pruebas locales.
 * Antes de producción es obligatorio dar de alta esas credenciales.
 */
export async function sendWhatsAppMessage(
  toPhone: string,
  message: string,
): Promise<{ sent: boolean; reason?: string }> {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    logger.warn(
      { toPhone },
      "whatsapp.send.not_configured — falta WHATSAPP_API_TOKEN/WHATSAPP_PHONE_NUMBER_ID, ver AGENTS.md §6.7",
    );
    return { sent: false, reason: "not_configured" };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toPhone,
        type: "text",
        text: { body: message },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      logger.error({ toPhone, status: res.status, body }, "whatsapp.send.failed");
      return { sent: false, reason: "provider_error" };
    }
    logger.info({ toPhone }, "whatsapp.send.success");
    return { sent: true };
  } catch (err) {
    logger.error({ toPhone, err }, "whatsapp.send.exception");
    return { sent: false, reason: "network_error" };
  }
}
