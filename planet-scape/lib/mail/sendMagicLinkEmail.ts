import fs from "node:fs";
import path from "node:path";
import Handlebars from "handlebars";
import nodemailer from "nodemailer";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { logger } from "@/lib/logger";

// Motor de plantillas: Handlebars (requisito de la skill toscaprompt para
// "Arquitectura Mail"). Compilado una sola vez, cacheado en el módulo.
const templatePath = path.join(process.cwd(), "lib/mail/templates/magicLink.hbs");
let compiledTemplate: HandlebarsTemplateDelegate | null = null;

function getTemplate() {
  if (!compiledTemplate) {
    const source = fs.readFileSync(templatePath, "utf-8");
    compiledTemplate = Handlebars.compile(source);
  }
  return compiledTemplate;
}

export async function sendMagicLinkEmail(params: {
  to: string;
  url: string;
  code: string;
  locale: AppLocale;
}) {
  const { to, url, code, locale } = params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  const tMeta = await getTranslations({ locale, namespace: "Metadata" });

  const html = getTemplate()({
    locale,
    appName: tMeta("title"),
    greeting: t("magicLinkGreeting"),
    codeLabel: t("magicLinkCodeLabel"),
    code,
    ctaLabel: t("magicLinkCta"),
    expiryNotice: t("magicLinkExpiry"),
    magicLinkUrl: url,
  });

  const transport = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT ?? 1025),
    auth: process.env.EMAIL_SERVER_USER
      ? { user: process.env.EMAIL_SERVER_USER, pass: process.env.EMAIL_SERVER_PASSWORD }
      : undefined,
  });

  await transport.sendMail({
    to,
    from: process.env.EMAIL_FROM,
    subject: tMeta("title"),
    html,
  });

  logger.info({ to, route: "auth.magicLink" }, "auth.magic_link.sent");
}
