import { players, matches, type Player, type InsertPlayer, type Match, type InsertMatch, type PlayerStats, type AuthUser, type SetupRequest } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Authentication and Setup
  isInitialized(): Promise<boolean>;
  setupInitialManager(setup: SetupRequest): Promise<AuthUser>;
  getCurrentUser(): Promise<AuthUser | null>;
  setCurrentUser(userId: number): Promise<void>;
  
  // Player management
  getPlayer(id: number): Promise<Player | undefined>;
  getAllPlayers(): Promise<Player[]>;
  createPlayer(player: InsertPlayer): Promise<Player>;
  updatePlayer(id: number, updates: Partial<InsertPlayer>): Promise<Player>;
  deletePlayer(id: number): Promise<boolean>;
  
  // Match management
  getMatch(id: number): Promise<Match | undefined>;
  getAllMatches(): Promise<Match[]>;
  createMatch(match: InsertMatch): Promise<Match>;
  
  // Statistics
  getPlayerStats(playerId?: number): Promise<PlayerStats[]>;
  
  // Data management
  resetAllData(): Promise<void>;
}

// Database Storage Implementation

export class DatabaseStorage implements IStorage {
  private currentUser: AuthUser | null = null;

  async isInitialized(): Promise<boolean> {
    const managers = await db.select().from(players).where(eq(players.role, "manager"));
    return managers.length > 0;
  }

  async setupInitialManager(setup: SetupRequest): Promise<AuthUser> {
    const [manager] = await db
      .insert(players)
      .values({
        name: setup.managerName,
        skillLevel: setup.managerSkillLevel,
        role: "manager",
        isActive: true,
      })
      .returning();

    const authUser: AuthUser = {
      id: manager.id,
      name: manager.name,
      role: manager.role as "manager" | "player",
      skillLevel: manager.skillLevel,
    };

    // Don't automatically set current user - let each session choose
    return authUser;
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    return this.currentUser;
  }

  async setCurrentUser(userId: number): Promise<void> {
    const [user] = await db.select().from(players).where(eq(players.id, userId));
    if (user) {
      this.currentUser = {
        id: user.id,
        name: user.name,
        role: user.role as "manager" | "player",
        skillLevel: user.skillLevel,
      };
    }
  }

  async getPlayer(id: number): Promise<Player | undefined> {
    const [player] = await db.select().from(players).where(eq(players.id, id));
    return player || undefined;
  }

  async getAllPlayers(): Promise<Player[]> {
    return await db.select().from(players).where(eq(players.isActive, true));
  }

  async createPlayer(player: InsertPlayer): Promise<Player> {
    const [newPlayer] = await db
      .insert(players)
      .values({
        name: player.name,
        skillLevel: player.skillLevel,
        role: player.role || "player",
        isActive: true,
      })
      .returning();
    return newPlayer;
  }

  async updatePlayer(id: number, updates: Partial<InsertPlayer>): Promise<Player> {
    const [updatedPlayer] = await db
      .update(players)
      .set(updates)
      .where(eq(players.id, id))
      .returning();
    return updatedPlayer;
  }

  async deletePlayer(id: number): Promise<boolean> {
    const result = await db
      .update(players)
      .set({ isActive: false })
      .where(eq(players.id, id));
    return result.rowCount > 0;
  }

  async getMatch(id: number): Promise<Match | undefined> {
    const [match] = await db.select().from(matches).where(eq(matches.id, id));
    return match || undefined;
  }

  async getAllMatches(): Promise<Match[]> {
    return await db.select().from(matches);
  }

  async createMatch(match: InsertMatch): Promise<Match> {
    const [newMatch] = await db
      .insert(matches)
      .values(match)
      .returning();
    return newMatch;
  }

  async getPlayerStats(playerId?: number): Promise<PlayerStats[]> {
    const allPlayers = await this.getAllPlayers();
    const allMatches = await this.getAllMatches();
    
    const stats: PlayerStats[] = [];
    
    for (const player of allPlayers) {
      if (playerId && player.id !== playerId) continue;
      
      const playerMatches = allMatches.filter(match => 
        match.teamAPlayer1Id === player.id ||
        match.teamAPlayer2Id === player.id ||
        match.teamBPlayer1Id === player.id ||
        match.teamBPlayer2Id === player.id
      );
      
      let wins = 0;
      for (const match of playerMatches) {
        const isTeamA = match.teamAPlayer1Id === player.id || match.teamAPlayer2Id === player.id;
        const teamWon = match.winnerId === 1 ? "A" : "B";
        if ((isTeamA && teamWon === "A") || (!isTeamA && teamWon === "B")) {
          wins++;
        }
      }
      
      const losses = playerMatches.length - wins;
      const winRate = playerMatches.length > 0 ? Math.round((wins / playerMatches.length) * 100) : 0;
      
      let suggestedSkillLevel: number | undefined;
      let suggestion: "increase" | "decrease" | "maintain" | undefined;
      let suggestionReason: string | undefined;
      
      if (playerMatches.length >= 3) {
        if (winRate >= 70) {
          suggestedSkillLevel = Math.min(10, player.skillLevel + 1);
          suggestion = "increase";
          suggestionReason = `High win rate (${winRate}%) suggests skill level could be increased`;
        } else if (winRate <= 30) {
          suggestedSkillLevel = Math.max(1, player.skillLevel - 1);
          suggestion = "decrease";
          suggestionReason = `Low win rate (${winRate}%) suggests skill level could be decreased`;
        } else {
          suggestedSkillLevel = player.skillLevel;
          suggestion = "maintain";
          suggestionReason = `Balanced win rate (${winRate}%) indicates appropriate skill level`;
        }
      }
      
      stats.push({
        playerId: player.id,
        name: player.name,
        skillLevel: player.skillLevel,
        role: player.role as "manager" | "player",
        totalMatches: playerMatches.length,
        wins,
        losses,
        winRate,
        suggestedSkillLevel,
        suggestion,
        suggestionReason,
      });
    }
    
    return stats;
  }

  async resetAllData(): Promise<void> {
    await db.delete(matches);
    await db.delete(players);
    this.currentUser = null;
  }
}

export const storage = new DatabaseStorage();
