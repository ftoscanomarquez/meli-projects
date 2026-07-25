import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { randomInt } from "node:crypto";
import { clientPromise, MONGODB_DB, getDb } from "@/lib/db";
import { sendMagicLinkEmail } from "@/lib/mail/sendMagicLinkEmail";
import { logger } from "@/lib/logger";
import { routing, type AppLocale } from "@/i18n/routing";
import { ObjectId } from "mongodb";

// Código de 6 dígitos en vez del token largo por defecto (2026-07-22, pedido
// explícito del usuario: poder entrar desde Mailpit tecleando un código en
// vez de tener que compartir/abrir el enlace en el celular). `randomInt` de
// `node:crypto` (nunca Math.random — ver AGENTS.md §12.5) genera el número;
// Auth.js hashea y guarda este valor exactamente igual que el token largo
// original, así que la verificación no cambia, solo el formato del valor.
const VERIFICATION_CODE_MAX_AGE_S = 600; // 10 min — antes 24h, acortado porque
// un código de 6 dígitos (1,000,000 combinaciones) tiene mucha menos entropía
// que el token de 32 bytes original; una ventana corta + rate limit en
// /api/auth/callback/nodemailer (ver proxy.ts) es la mitigación real.
function generateSixDigitCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// Confianza dinámica en vez de una lista fija de IPs — pedido explícito del
// usuario (2026-07-24) tras encontrar que el login por código seguía
// mandando al celular a localhost: "no deberian ser datos fijos estas
// redirecciones... urls harcodeadas". En vez de mantener a mano cada IP de
// LAN nueva, se confía en CUALQUIER origen de red local/privada (localhost,
// 127.0.0.1, o los rangos privados RFC 1918: 10.x, 172.16-31.x, 192.168.x)
// — sigue siendo seguro porque nunca se usa en producción (ver el `if`
// dentro de la función): un origen de internet real jamás cae en estos
// rangos.
function isTrustedRedirectOrigin(origin: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)
    );
  } catch {
    return false;
  }
}

/**
 * Auth.js (Magic Link) — ver AGENTS.md §6.
 *
 * El adapter de Mongo mapea su colección "Users" a nuestra colección
 * `players` (PlayerSchema) — Auth.js SOLO conoce name/email/emailVerified/
 * image por defecto; los campos de negocio (stars, role, unlockedPlanets,
 * displayName) se inicializan en el evento `createUser` y se exponen en
 * `session.user` vía el callback `session` (ver types/next-auth.d.ts).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MongoDBAdapter(clientPromise, {
    databaseName: MONGODB_DB,
    collections: { Users: "players" },
  }),
  session: { strategy: "database" },
  // Requerido fuera de Vercel (que lo detecta solo): confía en el header
  // Host para construir URLs de callback. Ver DEPLOYMENT.md — en self-hosting
  // ponerlo detrás de un proxy que fije el Host correctamente.
  trustHost: true,
  providers: [
    Nodemailer({
      from: process.env.EMAIL_FROM,
      maxAge: VERIFICATION_CODE_MAX_AGE_S,
      generateVerificationToken: generateSixDigitCode,
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT ?? 1025),
        auth: process.env.EMAIL_SERVER_USER
          ? { user: process.env.EMAIL_SERVER_USER, pass: process.env.EMAIL_SERVER_PASSWORD }
          : undefined,
      },
      async sendVerificationRequest({ identifier, url, token, request }) {
        // Con las páginas por defecto de Auth.js (Fase 1) no hay forma de
        // saber el locale del jugador, así que cae a `defaultLocale` ("es").
        // El formulario custom de Fase 2 debe enviar `?locale=` en la request
        // de sign-in para que esto detecte "en" correctamente.
        const requestedLocale = new URL(request.url).searchParams.get("locale");
        const locale: AppLocale = routing.locales.includes(requestedLocale as AppLocale)
          ? (requestedLocale as AppLocale)
          : routing.defaultLocale;

        // `token` aquí ya es el código de 6 dígitos (generateVerificationToken
        // arriba) — se manda también el enlace de un clic por si se revisa el
        // correo desde el mismo dispositivo, pero el código es el método
        // principal que pidió el usuario (ver AGENTS.md §6.3).
        await sendMagicLinkEmail({ to: identifier, url, code: token, locale });
      },
    }),
  ],
  events: {
    async createUser({ user }) {
      // Fase 0-1: valores por defecto de un jugador nuevo — ver PlayerSchema
      // en SPECIFICATION-SUMMARY.md §3. `displayName` es un placeholder
      // temporal (único porque usa el propio ObjectId, ya que hay un índice
      // único sobre este campo — ver scripts/seeds/seed-schema.ts) hasta que
      // el jugador complete el registro obligatorio de alias/nombre/apellido
      // (ver AGENTS.md §6.4, `ProfileOnboarding.tsx`) — `profileCompleted:
      // false` gatea esa pantalla.
      const db = await getDb();
      const playerId = new ObjectId(user.id);
      await db.collection("players").updateOne(
        { _id: playerId },
        {
          $set: {
            displayName: `jugador_${playerId.toHexString().slice(-6)}`,
            firstName: "",
            lastName: "",
            profileCompleted: false,
            stars: 0,
            role: "player",
            unlockedPlanets: [],
            createdAt: new Date(),
          },
        },
      );
      logger.info({ playerId: user.id }, "auth.player.created");
    },
    async signIn({ user }) {
      const db = await getDb();
      await db
        .collection("players")
        .updateOne({ _id: new ObjectId(user.id) }, { $set: { lastLoginAt: new Date() } });
      logger.info({ playerId: user.id }, "auth.signin.success");
    },
  },
  callbacks: {
    // Bug real reportado por el usuario (2026-07-22, ver RETROSPECTIVA.md):
    // al probar desde el celular por IP de red local (ej. 192.168.101.7),
    // el correo del Magic Link SÍ se genera con la IP correcta, pero al
    // hacer clic el `baseUrl` que Auth.js calcula internamente para ESA
    // request específica del callback cae a `http://localhost:3000` (pese a
    // `trustHost: true`) — el `redirect` callback por defecto entonces
    // descarta la URL real y manda a `baseUrl`, que en el celular no
    // resuelve a nada (localhost ahí es el propio celular).
    //
    // Reaparecido 2026-07-24 con el login por código de 6 dígitos: la
    // primera versión de este fix solo validaba URLs ABSOLUTAS contra una
    // whitelist fija — pero `callbackUrl` ahí llegaba como ruta RELATIVA
    // (`/${locale}`), que caía directo al primer `if` de abajo y
    // confiaba ciegamente en el mismo `baseUrl` ya demostrado poco fiable,
    // saltándose la validación por completo. Ahora TODA URL (relativa o
    // absoluta) se resuelve a un origen real y se valida contra
    // `isTrustedRedirectOrigin()` antes de confiar en ella — nunca se
    // regresa `baseUrl${url}` sin pasar por esa validación.
    async redirect({ url, baseUrl }) {
      try {
        const resolved = new URL(url, baseUrl);
        if (resolved.origin === baseUrl || isTrustedRedirectOrigin(resolved.origin)) return resolved.toString();
      } catch {
        // URL inválida — cae a baseUrl abajo.
      }
      return baseUrl;
    },
    async session({ session, user }) {
      session.user.id = user.id;
      session.user.stars = user.stars ?? 0;
      session.user.role = user.role ?? "player";
      session.user.unlockedPlanets = user.unlockedPlanets ?? [];
      session.user.displayName = user.displayName ?? session.user.email ?? "Jugador";
      session.user.firstName = user.firstName ?? "";
      session.user.lastName = user.lastName ?? "";
      // Cuentas creadas antes de este cambio (2026-07-22) no tienen el campo
      // — se tratan como ya completas para no interrumpirlas con el
      // registro obligatorio de un dato que nunca se les pidió.
      session.user.profileCompleted = user.profileCompleted ?? true;
      // Chat en vivo de multijugador (ver AGENTS.md §6.5) — "fail closed":
      // si no se sabe la edad (cuenta vieja sin `birthDate`), se trata como
      // NO mayor de edad, nunca al revés. Nunca se expone la fecha de
      // nacimiento exacta al cliente, solo este booleano ya calculado.
      session.user.isAdult = user.isAdult ?? false;
      // Cuenta inhabilitada por acoso/lenguaje inapropiado (ver AGENTS.md
      // §6.6, sistema de amonestaciones) — "fail closed" al revés de
      // isAdult: si el campo no existe (cuenta nunca amonestada), se trata
      // como NO baneada. `BannedGate.tsx` bloquea toda la app mientras esto
      // sea `true`; nunca se borra la cuenta, solo se le impide usarla.
      session.user.banned = user.banned ?? false;
      return session;
    },
  },
});
