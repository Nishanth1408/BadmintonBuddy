import { players, matches, otpCodes, type Player, type InsertPlayer, type Match, type InsertMatch, type PlayerStats, type AuthUser, type SetupRequest } from "@shared/schema";
import { db } from "./db";
import { eq, and, gt } from "drizzle-orm";
import { smsService } from "./sms-service";

export interface IStorage {
  // Authentication and Setup
  isInitialized(): Promise<boolean>;
  setupInitialManager(setup: SetupRequest): Promise<AuthUser>;
  getCurrentUser(): Promise<AuthUser | null>;
  setCurrentUser(userId: number | null): Promise<void>;
  
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
  updateMatch(id: number, updates: Partial<InsertMatch>): Promise<Match>;
  deleteMatch(id: number): Promise<boolean>;
  
  // Skill level management
  updatePlayerSkillLevel(playerId: number, newSkillLevel: number): Promise<void>;
  checkForSkillLevelUpdates(): Promise<void>;
  
  // Statistics
  getPlayerStats(playerId?: number): Promise<PlayerStats[]>;
  
  // Data management
  resetAllData(): Promise<void>;
  
  // OTP management
  sendOTP(playerId: number): Promise<boolean>;
  verifyOTP(playerId: number, code: string): Promise<boolean>;
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
        mobileNumber: setup.managerMobile,
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

  async setCurrentUser(userId: number | null): Promise<void> {
    if (userId === null) {
      this.currentUser = null;
      return;
    }
    
    const [user] = await db.select().from(players).where(eq(players.id, userId));
    if (user) {
      this.currentUser = {
        id: user.id,
        name: user.name,
        role: user.role as "manager" | "player",
        skillLevel: user.skillLevel,
      };
    } else {
      this.currentUser = null;
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
        mobileNumber: player.mobileNumber,
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
    return (result.rowCount || 0) > 0;
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
    
    // Auto-update skill levels after each match
    await this.checkForSkillLevelUpdates();
    
    return newMatch;
  }

  async updateMatch(id: number, updateData: Partial<InsertMatch>): Promise<Match> {
    const [updatedMatch] = await db
      .update(matches)
      .set(updateData)
      .where(eq(matches.id, id))
      .returning();

    if (!updatedMatch) {
      throw new Error("Match not found");
    }

    // Recalculate skill levels for all players after match update
    await this.checkForSkillLevelUpdates();

    return updatedMatch;
  }

  async deleteMatch(id: number): Promise<boolean> {
    const result = await db
      .delete(matches)
      .where(eq(matches.id, id));

    if (result.rowCount && result.rowCount > 0) {
      // Recalculate skill levels for all players after deletion
      await this.checkForSkillLevelUpdates();
      return true;
    }
    return false;
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
      ).sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());
      
      // Get last 3 matches for recent performance analysis
      const recentMatches = playerMatches.slice(0, 3);
      
      let wins = 0;
      let recentWins = 0;
      
      for (const match of playerMatches) {
        const isTeamA = match.teamAPlayer1Id === player.id || match.teamAPlayer2Id === player.id;
        const teamWon = match.winnerId === 1 ? "A" : "B";
        if ((isTeamA && teamWon === "A") || (!isTeamA && teamWon === "B")) {
          wins++;
        }
      }
      
      for (const match of recentMatches) {
        const isTeamA = match.teamAPlayer1Id === player.id || match.teamAPlayer2Id === player.id;
        const teamWon = match.winnerId === 1 ? "A" : "B";
        if ((isTeamA && teamWon === "A") || (!isTeamA && teamWon === "B")) {
          recentWins++;
        }
      }
      
      const losses = playerMatches.length - wins;
      const winRate = playerMatches.length > 0 ? Math.round((wins / playerMatches.length) * 100) : 0;
      const recentWinRate = recentMatches.length > 0 ? Math.round((recentWins / recentMatches.length) * 100) : 0;
      
      // Calculate skill level change indicator
      let skillLevelChange: "increased" | "decreased" | "unchanged" | undefined;
      if (player.previousSkillLevel !== null && player.previousSkillLevel !== undefined) {
        if (player.skillLevel > player.previousSkillLevel) {
          skillLevelChange = "increased";
        } else if (player.skillLevel < player.previousSkillLevel) {
          skillLevelChange = "decreased";
        } else {
          skillLevelChange = "unchanged";
        }
      }
      
      // Determine recent performance trend
      let recentPerformance: "improving" | "declining" | "stable" | undefined;
      if (recentMatches.length >= 3) {
        if (recentWinRate >= 67) { // 2/3 wins
          recentPerformance = "improving";
        } else if (recentWinRate <= 33) { // 1/3 wins or less
          recentPerformance = "declining";
        } else {
          recentPerformance = "stable";
        }
      }
      
      let suggestedSkillLevel: number | undefined;
      let suggestion: "increase" | "decrease" | "maintain" | undefined;
      let suggestionReason: string | undefined;
      
      if (recentMatches.length >= 3) {
        // Enhanced suggestions considering opponent strength
        let suggestionScore = 0;
        for (const match of recentMatches) {
          const isTeamA = match.teamAPlayer1Id === player.id || match.teamAPlayer2Id === player.id;
          const teamWon = match.winnerId === 1 ? "A" : "B";
          const playerWon = (isTeamA && teamWon === "A") || (!isTeamA && teamWon === "B");
          
          // Get opponent skill levels for this match
          let opponentSkillLevels: number[] = [];
          if (isTeamA) {
            const opponent1 = allPlayers.find(p => p.id === match.teamBPlayer1Id);
            const opponent2 = allPlayers.find(p => p.id === match.teamBPlayer2Id);
            if (opponent1) opponentSkillLevels.push(opponent1.skillLevel);
            if (opponent2) opponentSkillLevels.push(opponent2.skillLevel);
          } else {
            const opponent1 = allPlayers.find(p => p.id === match.teamAPlayer1Id);
            const opponent2 = allPlayers.find(p => p.id === match.teamAPlayer2Id);
            if (opponent1) opponentSkillLevels.push(opponent1.skillLevel);
            if (opponent2) opponentSkillLevels.push(opponent2.skillLevel);
          }
          
          const avgOpponentSkill = opponentSkillLevels.length > 0 
            ? opponentSkillLevels.reduce((sum, skill) => sum + skill, 0) / opponentSkillLevels.length 
            : player.skillLevel;
          
          const skillDifference = avgOpponentSkill - player.skillLevel;
          
          if (playerWon) {
            suggestionScore += skillDifference >= 0 ? 1 + (skillDifference * 0.3) : 1 - (Math.abs(skillDifference) * 0.2);
          } else {
            suggestionScore += skillDifference <= 0 ? -(1 + (Math.abs(skillDifference) * 0.3)) : -(1 - (skillDifference * 0.2));
          }
        }
        
        const avgWeightedPerformance = suggestionScore / recentMatches.length;
        
        if (avgWeightedPerformance > 0.4) {
          suggestedSkillLevel = Math.min(10, player.skillLevel + 1);
          suggestion = "increase";
          suggestionReason = `Excellent performance against quality opposition (${recentWins}/${recentMatches.length} wins). Ready for higher competition.`;
        } else if (avgWeightedPerformance < -0.4) {
          suggestedSkillLevel = Math.max(1, player.skillLevel - 1);
          suggestion = "decrease";
          suggestionReason = `Struggling against current level opponents (${recentWins}/${recentMatches.length} wins). Consider skill adjustment.`;
        } else {
          suggestedSkillLevel = player.skillLevel;
          suggestion = "maintain";
          suggestionReason = `Balanced performance considering opponent strength (${recentWins}/${recentMatches.length} wins). Current level appropriate.`;
        }
      }
      
      stats.push({
        playerId: player.id,
        name: player.name,
        skillLevel: player.skillLevel,
        previousSkillLevel: player.previousSkillLevel || undefined,
        skillLevelChange,
        role: player.role as "manager" | "player",
        totalMatches: playerMatches.length,
        wins,
        losses,
        winRate,
        suggestedSkillLevel,
        suggestion,
        suggestionReason,
        recentPerformance,
      });
    }
    
    return stats;
  }

  async updatePlayerSkillLevel(playerId: number, newSkillLevel: number): Promise<void> {
    const player = await this.getPlayer(playerId);
    if (!player) return;
    
    await db
      .update(players)
      .set({
        previousSkillLevel: player.skillLevel,
        skillLevel: newSkillLevel,
        lastSkillUpdate: new Date(),
      })
      .where(eq(players.id, playerId));
  }

  async checkForSkillLevelUpdates(): Promise<void> {
    const allPlayers = await this.getAllPlayers();
    const allMatches = await this.getAllMatches();
    
    for (const player of allPlayers) {
      const playerMatches = allMatches.filter(match => 
        match.teamAPlayer1Id === player.id ||
        match.teamAPlayer2Id === player.id ||
        match.teamBPlayer1Id === player.id ||
        match.teamBPlayer2Id === player.id
      ).sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());
      
      // Only check if player has played at least 3 matches
      if (playerMatches.length < 3) continue;
      
      // Get last 3 matches for enhanced skill analysis
      const recentMatches = playerMatches.slice(0, 3);
      let weightedPerformanceScore = 0;
      let totalWeight = 0;
      
      for (const match of recentMatches) {
        const isTeamA = match.teamAPlayer1Id === player.id || match.teamAPlayer2Id === player.id;
        const teamWon = match.winnerId === 1 ? "A" : "B";
        const playerWon = (isTeamA && teamWon === "A") || (!isTeamA && teamWon === "B");
        
        // Get opposition team players
        let opponentSkillLevels: number[] = [];
        if (isTeamA) {
          // Player is in Team A, opponents are Team B
          const opponent1 = allPlayers.find(p => p.id === match.teamBPlayer1Id);
          const opponent2 = allPlayers.find(p => p.id === match.teamBPlayer2Id);
          if (opponent1) opponentSkillLevels.push(opponent1.skillLevel);
          if (opponent2) opponentSkillLevels.push(opponent2.skillLevel);
        } else {
          // Player is in Team B, opponents are Team A
          const opponent1 = allPlayers.find(p => p.id === match.teamAPlayer1Id);
          const opponent2 = allPlayers.find(p => p.id === match.teamAPlayer2Id);
          if (opponent1) opponentSkillLevels.push(opponent1.skillLevel);
          if (opponent2) opponentSkillLevels.push(opponent2.skillLevel);
        }
        
        // Calculate average opponent skill level
        const avgOpponentSkill = opponentSkillLevels.length > 0 
          ? opponentSkillLevels.reduce((sum, skill) => sum + skill, 0) / opponentSkillLevels.length 
          : player.skillLevel; // Default to player's level if no opponents found
        
        // Calculate difficulty weight based on opponent strength relative to player
        const skillDifference = avgOpponentSkill - player.skillLevel;
        
        // Weight factor: 
        // - Beating stronger opponents (positive skillDifference) is weighted higher
        // - Losing to weaker opponents (negative skillDifference) is weighted higher for penalties
        let difficultyWeight = 1.0;
        if (skillDifference > 0) {
          // Opponents are stronger - wins count more, losses count less
          difficultyWeight = 1.0 + (skillDifference * 0.2); // +20% weight per skill level difference
        } else if (skillDifference < 0) {
          // Opponents are weaker - losses count more, wins count less
          difficultyWeight = 1.0 + (Math.abs(skillDifference) * 0.15); // +15% penalty weight per skill level difference
        }
        
        // Calculate performance score for this match
        let matchScore = 0;
        if (playerWon) {
          if (skillDifference >= 0) {
            // Beat equal or stronger opponents - positive score enhanced by difficulty
            matchScore = 1.0 * difficultyWeight;
          } else {
            // Beat weaker opponents - reduced positive score
            matchScore = 1.0 / difficultyWeight;
          }
        } else {
          if (skillDifference <= 0) {
            // Lost to equal or weaker opponents - negative score enhanced by penalty
            matchScore = -1.0 * difficultyWeight;
          } else {
            // Lost to stronger opponents - reduced negative impact
            matchScore = -1.0 / difficultyWeight;
          }
        }
        
        weightedPerformanceScore += matchScore;
        totalWeight += 1.0;
      }
      
      // Calculate average weighted performance
      const avgPerformance = totalWeight > 0 ? weightedPerformanceScore / totalWeight : 0;
      let newSkillLevel = player.skillLevel;
      
      // Enhanced skill level adjustment based on weighted performance
      if (avgPerformance > 0.5 && player.skillLevel < 10) {
        // Strong weighted performance against appropriate opposition
        newSkillLevel = player.skillLevel + 1;
      } else if (avgPerformance < -0.5 && player.skillLevel > 1) {
        // Poor weighted performance considering opposition strength
        newSkillLevel = player.skillLevel - 1;
      }
      
      // Update skill level if it should change
      if (newSkillLevel !== player.skillLevel) {
        console.log(`Updating ${player.name} skill level from ${player.skillLevel} to ${newSkillLevel} (weighted performance: ${avgPerformance.toFixed(2)})`);
        await this.updatePlayerSkillLevel(player.id, newSkillLevel);
      }
    }
  }

  async resetAllData(): Promise<void> {
    await db.delete(otpCodes);
    await db.delete(matches);
    await db.delete(players);
    this.currentUser = null;
  }

  async sendOTP(playerId: number): Promise<boolean> {
    try {
      // Get player's mobile number
      const [player] = await db.select().from(players).where(eq(players.id, playerId));
      if (!player) {
        return false;
      }

      // Generate OTP
      const code = smsService.generateOTP();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Save OTP to database
      await db.insert(otpCodes).values({
        playerId,
        code,
        expiresAt,
        isUsed: false,
      });

      // Send SMS
      const sent = await smsService.sendOTP(player.mobileNumber, code);
      return sent;
    } catch (error) {
      console.error('Failed to send OTP:', error);
      return false;
    }
  }

  async verifyOTP(playerId: number, code: string): Promise<boolean> {
    try {
      // Find valid OTP
      const [otpRecord] = await db
        .select()
        .from(otpCodes)
        .where(
          and(
            eq(otpCodes.playerId, playerId),
            eq(otpCodes.code, code),
            eq(otpCodes.isUsed, false),
            gt(otpCodes.expiresAt, new Date())
          )
        );

      if (!otpRecord) {
        return false;
      }

      // Mark OTP as used
      await db
        .update(otpCodes)
        .set({ isUsed: true })
        .where(eq(otpCodes.id, otpRecord.id));

      return true;
    } catch (error) {
      console.error('Failed to verify OTP:', error);
      return false;
    }
  }
}

export const storage = new DatabaseStorage();
