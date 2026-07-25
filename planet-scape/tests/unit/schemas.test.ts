import { describe, expect, it } from "vitest";
import { GameConfigSchema, DEFAULT_GAME_CONFIG } from "@/lib/schemas/gameConfig";
import { AdjustStarsRequestSchema, PlayerSearchResultSchema } from "@/lib/schemas/admin";
import { CreateCheckoutRequestSchema, DonationSchema } from "@/lib/schemas/donation";
import { CompleteSessionRequestSchema, GameSessionSchema } from "@/lib/schemas/gameSession";
import { StarTransactionSchema } from "@/lib/schemas/starTransaction";
import { LeaderboardEntrySchema } from "@/lib/schemas/leaderboard";

describe("GameConfigSchema", () => {
  it("accepts the real launch defaults (DEFAULT_GAME_CONFIG)", () => {
    expect(GameConfigSchema.safeParse(DEFAULT_GAME_CONFIG).success).toBe(true);
  });

  it("rejects a config missing a required ability timing", () => {
    const broken = { ...DEFAULT_GAME_CONFIG, abilities: { venus: DEFAULT_GAME_CONFIG.abilities.venus } };
    expect(GameConfigSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects non-positive durationMs/cooldownMs (admin panel input guard)", () => {
    const broken = {
      ...DEFAULT_GAME_CONFIG,
      abilities: {
        ...DEFAULT_GAME_CONFIG.abilities,
        mercury: { durationMs: 0, cooldownMs: 30000 },
      },
    };
    expect(GameConfigSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects blackHole.minClicksToDefeat below 1", () => {
    const broken = {
      ...DEFAULT_GAME_CONFIG,
      blackHole: { ...DEFAULT_GAME_CONFIG.blackHole, minClicksToDefeat: 0 },
    };
    expect(GameConfigSchema.safeParse(broken).success).toBe(false);
  });
});

describe("AdjustStarsRequestSchema (admin star adjustment)", () => {
  it("accepts positive and negative non-zero deltas", () => {
    expect(AdjustStarsRequestSchema.safeParse({ amount: 42 }).success).toBe(true);
    expect(AdjustStarsRequestSchema.safeParse({ amount: -10 }).success).toBe(true);
  });

  it("rejects amount 0 (a no-op adjustment)", () => {
    expect(AdjustStarsRequestSchema.safeParse({ amount: 0 }).success).toBe(false);
  });

  it("rejects non-integer amounts", () => {
    expect(AdjustStarsRequestSchema.safeParse({ amount: 1.5 }).success).toBe(false);
  });
});

describe("PlayerSearchResultSchema", () => {
  it("accepts a well-formed player row", () => {
    const row = { id: "abc123", email: "a@b.com", displayName: "A", stars: 10, role: "player" };
    expect(PlayerSearchResultSchema.safeParse(row).success).toBe(true);
  });

  it("rejects an unknown role", () => {
    const row = { id: "abc123", email: "a@b.com", displayName: "A", stars: 10, role: "superadmin" };
    expect(PlayerSearchResultSchema.safeParse(row).success).toBe(false);
  });
});

describe("CreateCheckoutRequestSchema (donation)", () => {
  it("accepts a positive integer amount in cents", () => {
    expect(CreateCheckoutRequestSchema.safeParse({ amountCents: 10000 }).success).toBe(true);
  });

  it("rejects zero, negative, or non-integer amounts", () => {
    expect(CreateCheckoutRequestSchema.safeParse({ amountCents: 0 }).success).toBe(false);
    expect(CreateCheckoutRequestSchema.safeParse({ amountCents: -500 }).success).toBe(false);
    expect(CreateCheckoutRequestSchema.safeParse({ amountCents: 99.5 }).success).toBe(false);
  });

  // El rango real (mín $100 / máx $10,000 MXN) se valida en la ruta contra
  // game_config.donation (Fase 8), no en este schema — ver AGENTS.md §10.
});

describe("DonationSchema", () => {
  it("accepts a completed donation document", () => {
    const doc = {
      _id: "x",
      playerId: "p1",
      amountCents: 10000,
      currency: "mxn",
      stripeSessionId: "cs_test_123",
      status: "completed",
      createdAt: new Date(),
    };
    expect(DonationSchema.safeParse(doc).success).toBe(true);
  });

  it("rejects a currency other than mxn", () => {
    const doc = {
      _id: "x",
      playerId: "p1",
      amountCents: 10000,
      currency: "usd",
      stripeSessionId: "cs_test_123",
      status: "pending",
      createdAt: new Date(),
    };
    expect(DonationSchema.safeParse(doc).success).toBe(false);
  });
});

describe("CompleteSessionRequestSchema", () => {
  it("accepts a valid solo-game payload without roomId", () => {
    const payload = { planet: "mercury", level: 4, starsCollected: 12 };
    expect(CompleteSessionRequestSchema.safeParse(payload).success).toBe(true);
  });

  it("accepts a valid multiplayer payload with roomId", () => {
    const payload = { planet: "earth", level: 2, starsCollected: 3, roomId: "ABC123" };
    expect(CompleteSessionRequestSchema.safeParse(payload).success).toBe(true);
  });

  it("rejects an unknown planet key (only the 4 starter planets are selectable)", () => {
    const payload = { planet: "jupiter", level: 1, starsCollected: 0 };
    expect(CompleteSessionRequestSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects negative level/starsCollected", () => {
    expect(CompleteSessionRequestSchema.safeParse({ planet: "mars", level: -1, starsCollected: 0 }).success).toBe(false);
    expect(CompleteSessionRequestSchema.safeParse({ planet: "mars", level: 0, starsCollected: -1 }).success).toBe(false);
  });
});

describe("GameSessionSchema", () => {
  it("accepts roomId: null for a solo game session", () => {
    const doc = {
      playerId: "p1",
      roomId: null,
      planet: "mercury",
      endedAt: new Date(),
      levelReached: 1,
      starsCollected: 0,
    };
    expect(GameSessionSchema.safeParse(doc).success).toBe(true);
  });
});

describe("StarTransactionSchema", () => {
  it("accepts every documented reason, including admin_adjustment with adminId", () => {
    const base = { playerId: "p1", amount: 5, createdAt: new Date() };
    for (const reason of ["gameplay", "donation_reward", "admin_adjustment", "planet_unlock"] as const) {
      expect(StarTransactionSchema.safeParse({ ...base, reason }).success).toBe(true);
    }
    expect(StarTransactionSchema.safeParse({ ...base, reason: "admin_adjustment", adminId: "admin1" }).success).toBe(true);
  });

  it("allows a negative amount (spending stars on a planet unlock)", () => {
    const doc = { playerId: "p1", amount: -200, reason: "planet_unlock", createdAt: new Date() };
    expect(StarTransactionSchema.safeParse(doc).success).toBe(true);
  });

  it("rejects an undocumented reason", () => {
    const doc = { playerId: "p1", amount: 5, reason: "bonus", createdAt: new Date() };
    expect(StarTransactionSchema.safeParse(doc).success).toBe(false);
  });
});

describe("LeaderboardEntrySchema", () => {
  it("rejects a negative bestScore", () => {
    const doc = { playerId: "p1", displayName: "A", bestScore: -1, levelReached: 0, achievedAt: new Date() };
    expect(LeaderboardEntrySchema.safeParse(doc).success).toBe(false);
  });
});
