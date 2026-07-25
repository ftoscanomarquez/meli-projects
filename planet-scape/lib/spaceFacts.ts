import { getDb } from "@/lib/db";
import type { AppLocale } from "@/i18n/routing";

export type SpaceFact = { key: number; es: string; en: string };

/** Lectura directa a Mongo desde Server Component — ver AGENTS.md §12 regla 6. */
export async function getSpaceFactText(key: number, locale: AppLocale): Promise<string | null> {
  const db = await getDb();
  const fact = await db.collection<SpaceFact>("space_facts").findOne({ key });
  if (!fact) return null;
  return locale === "en" ? fact.en : fact.es;
}
