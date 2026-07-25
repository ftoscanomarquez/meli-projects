/** Fórmula de puntaje para el leaderboard — ver lib/schemas/leaderboard.ts. */
export function computeScore(levelReached: number, starsCollected: number): number {
  return levelReached * 100 + starsCollected;
}
