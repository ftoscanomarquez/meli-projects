import { getDb } from "@/lib/db";
import { GameConfigSchema, DEFAULT_GAME_CONFIG, type GameConfig } from "@/lib/schemas/gameConfig";

/**
 * Lectura directa a Mongo — ver AGENTS.md §12 regla 6 y §9 (Fase 8). Se
 * llama al arrancar cada partida/lobby (Server Component) y desde el panel
 * admin; nunca cacheado más allá del propio request, para que un cambio de
 * admin se refleje en la siguiente partida sin redeploy.
 */
export async function getGameConfig(): Promise<GameConfig> {
  const db = await getDb();
  const doc = await db.collection("game_config").findOne({}, { projection: { _id: 0 } });
  if (!doc) return DEFAULT_GAME_CONFIG;

  const parsed = GameConfigSchema.safeParse(doc);
  return parsed.success ? parsed.data : DEFAULT_GAME_CONFIG;
}
