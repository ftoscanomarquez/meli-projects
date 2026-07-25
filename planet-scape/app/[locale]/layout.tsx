import type { Metadata, Viewport } from "next";
import { Baloo_2, Inter, JetBrains_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { GlobalContextProvider, type PlayerSession } from "@/lib/context/GlobalContext";
import { ClientErrorReporter } from "@/components/shared/ClientErrorReporter";
import { BannedGate } from "@/components/shared/BannedGate";
import { ProfileOnboarding } from "@/components/auth/ProfileOnboarding";
import { auth } from "@/lib/auth";
import { getAdminViewRole } from "@/lib/actions/adminView";
import { getGameConfig } from "@/lib/gameConfig";
import "../globals.css";

// Tipografía (ver AGENTS.md §1.1 — sistema de diseño derivado de SolarBalls):
// Baloo 2 = display juguetón/redondeado, Inter = cuerpo legible,
// JetBrains Mono = etiquetas tipo HUD (estrellas, nivel).
const baloo = Baloo_2({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-baloo" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-mono" });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// `viewport-fit=cover` habilita `env(safe-area-inset-*)` en CSS — sin esto,
// el HUD flotante (botón de habilidad, barra superior) puede quedar oculto
// tras el notch/isla dinámica o la barra de gestos en celulares reales —
// feedback real del usuario (2026-07-22), ver RETROSPECTIVA.md.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("title"), description: t("description") };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Habilita el renderizado estático de esta ruta con next-intl.
  // (La sesión de abajo vuelve esta ruta dinámica igual — ver AGENTS.md §5.1.)
  setRequestLocale(locale);

  const session = await auth();
  const initialSession: PlayerSession = session?.user
    ? {
        playerId: session.user.id,
        email: session.user.email ?? "",
        displayName: session.user.displayName,
        stars: session.user.stars,
        role: session.user.role,
        unlockedPlanets: session.user.unlockedPlanets ?? [],
        firstName: session.user.firstName ?? "",
        lastName: session.user.lastName ?? "",
        profileCompleted: session.user.profileCompleted ?? true,
        isAdult: session.user.isAdult ?? false,
        banned: session.user.banned ?? false,
      }
    : null;
  const adminViewRole = await getAdminViewRole();
  // Términos y Condiciones (ver AGENTS.md §6.5) — se leen aquí (Server
  // Component, directo a Mongo, ver AGENTS.md §12 regla 6/8) y se pasan como
  // prop a ProfileOnboarding (Client Component) en vez de crear un endpoint
  // público nuevo solo para esto: mismo patrón ya usado para `initialSession`.
  const gameConfig = await getGameConfig();

  return (
    <html lang={locale} className={`${baloo.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <NextIntlClientProvider>
          <GlobalContextProvider locale={locale} initialSession={initialSession} initialAdminViewRole={adminViewRole}>
            <ClientErrorReporter />
            <BannedGate />
            <ProfileOnboarding termsAndConditions={gameConfig.termsAndConditions} />
            {children}
          </GlobalContextProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
