import { MongoClient, type Db } from "mongodb";

/**
 * Singleton cacheado de conexión a MongoDB — ver AGENTS.md §7 y §12 regla 1.
 * Reutiliza la conexión entre invocaciones "warm" del mismo contenedor
 * serverless para no agotar el pool de conexiones en Vercel.
 *
 * Nombre de la base de datos: "planet_scape" (variable MONGODB_DB,
 * ver .env.example e INFRA.md §3).
 */

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB ?? "planet_scape";

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI no está definida — ver .env.example");
}

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function createClientPromise(): Promise<MongoClient> {
  const client = new MongoClient(MONGODB_URI as string);
  return client.connect();
}

// En desarrollo, cachea en `global` para sobrevivir al HMR de Turbopack.
// En producción (Vercel), cada instancia "warm" ya cachea el módulo.
const clientPromise: Promise<MongoClient> =
  process.env.NODE_ENV === "development"
    ? (global._mongoClientPromise ??= createClientPromise())
    : createClientPromise();

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(MONGODB_DB);
}

// Usado directamente por @auth/mongodb-adapter (lib/auth.ts) — requiere
// el MongoClient promise, no el Db ya resuelto.
export { clientPromise, MONGODB_DB };
