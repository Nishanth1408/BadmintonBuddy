import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  skillLevel: integer("skill_level").notNull(), // 1-10 scale
  originalSkillLevel: integer("original_skill_level"), // Track original level before auto-adjustments
  previousSkillLevel: integer("previous_skill_level"), // Track previous level for change indicators
  role: text("role", { enum: ["manager", "player"] }).notNull().default("player"),
  mobileNumber: text("mobile_number").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  lastSkillUpdate: timestamp("last_skill_update").defaultNow(),
});

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  teamAPlayer1Id: integer("team_a_player_1_id").notNull(),
  teamAPlayer2Id: integer("team_a_player_2_id").notNull(),
  teamBPlayer1Id: integer("team_b_player_1_id").notNull(),
  teamBPlayer2Id: integer("team_b_player_2_id").notNull(),
  teamAScore: integer("team_a_score").notNull(),
  teamBScore: integer("team_b_score").notNull(),
  winnerId: integer("winner_id").notNull(), // 1 for Team A, 2 for Team B
  playedAt: timestamp("played_at").defaultNow().notNull(),
});

export const otpCodes = pgTable("otp_codes", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isUsed: boolean("is_used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPlayerSchema = createInsertSchema(players).pick({
  name: true,
  skillLevel: true,
  role: true,
  mobileNumber: true,
}).extend({
  skillLevel: z.number().min(1).max(10),
  role: z.enum(["manager", "player"]).default("player"),
  mobileNumber: z.string().min(10).max(15).regex(/^\+?[1-9]\d{1,14}$/, "Invalid mobile number format"),
});

export const insertMatchSchema = createInsertSchema(matches).pick({
  teamAPlayer1Id: true,
  teamAPlayer2Id: true,
  teamBPlayer1Id: true,
  teamBPlayer2Id: true,
  teamAScore: true,
  teamBScore: true,
  winnerId: true,
}).extend({
  teamAScore: z.number().min(0),
  teamBScore: z.number().min(0),
  winnerId: z.number().min(1).max(2),
});

export type Player = typeof players.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Match = typeof matches.$inferSelect;
export type InsertMatch = z.infer<typeof insertMatchSchema>;

export interface PlayerStats {
  playerId: number;
  name: string;
  skillLevel: number;
  previousSkillLevel?: number;
  skillLevelChange?: "increased" | "decreased" | "unchanged";
  role: "manager" | "player";
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  suggestedSkillLevel?: number;
  suggestion?: "increase" | "decrease" | "maintain";
  suggestionReason?: string;
  recentPerformance?: "improving" | "declining" | "stable";
}

export interface AuthUser {
  id: number;
  name: string;
  role: "manager" | "player";
  skillLevel: number;
}

export interface SetupRequest {
  managerName: string;
  managerSkillLevel: number;
  managerMobile: string;
}

export interface OtpRequest {
  playerId: number;
}

export interface OtpVerify {
  playerId: number;
  code: string;
}

export const otpRequestSchema = z.object({
  playerId: z.number(),
});

export const otpVerifySchema = z.object({
  playerId: z.number(),
  code: z.string().length(6),
});

export interface TeamStats {
  player1: Player;
  player2: Player;
  skillScore: number;
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface StatsResponse {
  playerStats: PlayerStats[];
  teamStats: TeamStats[];
  totalMatches: number;
  activePlayers: number;
  weeklyMatches: number;
}

export interface DoublesTeam {
  player1: Player;
  player2: Player;
  balanceLevel: "Balanced" | "Unbalanced";
  skillScore: number; // Sum of both players' skill levels
}

// Database relations
export const playersRelations = relations(players, ({ many }) => ({
  teamAPlayer1Matches: many(matches, { relationName: "teamAPlayer1" }),
  teamAPlayer2Matches: many(matches, { relationName: "teamAPlayer2" }),
  teamBPlayer1Matches: many(matches, { relationName: "teamBPlayer1" }),
  teamBPlayer2Matches: many(matches, { relationName: "teamBPlayer2" }),
}));

export const matchesRelations = relations(matches, ({ one }) => ({
  teamAPlayer1: one(players, {
    fields: [matches.teamAPlayer1Id],
    references: [players.id],
    relationName: "teamAPlayer1",
  }),
  teamAPlayer2: one(players, {
    fields: [matches.teamAPlayer2Id],
    references: [players.id],
    relationName: "teamAPlayer2",
  }),
  teamBPlayer1: one(players, {
    fields: [matches.teamBPlayer1Id],
    references: [players.id],
    relationName: "teamBPlayer1",
  }),
  teamBPlayer2: one(players, {
    fields: [matches.teamBPlayer2Id],
    references: [players.id],
    relationName: "teamBPlayer2",
  }),
}));
