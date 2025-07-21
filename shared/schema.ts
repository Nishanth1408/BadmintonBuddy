import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  skillLevel: integer("skill_level").notNull(), // 1-10 scale
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

export const insertPlayerSchema = createInsertSchema(players).pick({
  name: true,
  skillLevel: true,
}).extend({
  skillLevel: z.number().min(1).max(10),
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
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  suggestedSkillLevel?: number;
  suggestion?: "increase" | "decrease" | "maintain";
  suggestionReason?: string;
}

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
