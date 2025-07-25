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
  getSkillLevelSuggestions(): Promise<Array<{ playerId: number; name: string; currentLevel: number; suggestedLevel: number; reason: string; matchesAnalyzed: number; matchesNeeded?: number }>>;
  recalculateAllSkillLevels(): Promise<void>;
  resetAllPlayersToLevel5(): Promise<void>;
  
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
        originalSkillLevel: player.skillLevel, // Store original skill level
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

    // Reset all skill levels and recalculate from scratch
    await this.recalculateAllSkillLevels();

    return updatedMatch;
  }

  async deleteMatch(id: number): Promise<boolean> {
    const result = await db
      .delete(matches)
      .where(eq(matches.id, id));

    if (result.rowCount && result.rowCount > 0) {
      // Reset all skill levels and recalculate from scratch
      await this.recalculateAllSkillLevels();
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
      let pointsFor = 0;
      let pointsAgainst = 0;
      
      for (const match of playerMatches) {
        const isTeamA = match.teamAPlayer1Id === player.id || match.teamAPlayer2Id === player.id;
        const teamWon = match.winnerId === 1 ? "A" : "B";
        
        // Track wins
        if ((isTeamA && teamWon === "A") || (!isTeamA && teamWon === "B")) {
          wins++;
        }
        
        // Track points
        if (isTeamA) {
          pointsFor += match.teamAScore;
          pointsAgainst += match.teamBScore;
        } else {
          pointsFor += match.teamBScore;
          pointsAgainst += match.teamAScore;
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
      const pointDifference = pointsFor - pointsAgainst;
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
        pointsFor,
        pointsAgainst,
        pointDifference,
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
    
    // Ensure skill level is bounded between 1 and 10
    const boundedSkillLevel = Math.max(1, Math.min(10, newSkillLevel));
    
    // Ensure skill level only changes by 1 at a time
    const maxChange = Math.abs(boundedSkillLevel - player.skillLevel);
    if (maxChange > 1) {
      console.warn(`Attempted to change ${player.name}'s skill level by ${maxChange} levels (from ${player.skillLevel} to ${boundedSkillLevel}). Limiting change to 1 level.`);
      if (boundedSkillLevel > player.skillLevel) {
        newSkillLevel = player.skillLevel + 1;
      } else {
        newSkillLevel = player.skillLevel - 1;
      }
    } else {
      newSkillLevel = boundedSkillLevel;
    }
    
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
      
      // Skip players with less than 3 matches
      if (playerMatches.length < 3) continue;
      
      // Determine if we should auto-update (5+ matches) or just suggest (3-4 matches)
      const shouldAutoUpdate = playerMatches.length >= 5;
      const matchesToAnalyze = shouldAutoUpdate ? 5 : Math.min(playerMatches.length, 3);
      
      // Get recent matches for analysis
      const recentMatches = playerMatches.slice(0, matchesToAnalyze);
      let weightedPerformanceScore = 0;
      let totalWeight = 0;
      
      for (const match of recentMatches) {
        const isTeamA = match.teamAPlayer1Id === player.id || match.teamAPlayer2Id === player.id;
        const teamWon = match.winnerId === 1 ? "A" : "B";
        const playerWon = (isTeamA && teamWon === "A") || (!isTeamA && teamWon === "B");
        
        // Get opposition team players and match score data
        let opponentSkillLevels: number[] = [];
        let playerScore = 0;
        let opponentScore = 0;
        
        if (isTeamA) {
          // Player is in Team A, opponents are Team B
          const opponent1 = allPlayers.find(p => p.id === match.teamBPlayer1Id);
          const opponent2 = allPlayers.find(p => p.id === match.teamBPlayer2Id);
          if (opponent1) opponentSkillLevels.push(opponent1.skillLevel);
          if (opponent2) opponentSkillLevels.push(opponent2.skillLevel);
          playerScore = match.teamAScore;
          opponentScore = match.teamBScore;
        } else {
          // Player is in Team B, opponents are Team A
          const opponent1 = allPlayers.find(p => p.id === match.teamAPlayer1Id);
          const opponent2 = allPlayers.find(p => p.id === match.teamAPlayer2Id);
          if (opponent1) opponentSkillLevels.push(opponent1.skillLevel);
          if (opponent2) opponentSkillLevels.push(opponent2.skillLevel);
          playerScore = match.teamBScore;
          opponentScore = match.teamAScore;
        }
        
        // Calculate average opponent skill level
        const avgOpponentSkill = opponentSkillLevels.length > 0 
          ? opponentSkillLevels.reduce((sum, skill) => sum + skill, 0) / opponentSkillLevels.length 
          : player.skillLevel; // Default to player's level if no opponents found
        
        // Calculate skill difference and point difference
        const skillDifference = avgOpponentSkill - player.skillLevel;
        const pointDifference = playerScore - opponentScore;
        
        // Enhanced performance scoring considering both win/loss and point difference
        let matchScore = 0;
        
        if (playerWon) {
          // Base win score
          let winScore = 1.0;
          
          // Bonus for beating stronger opponents
          if (skillDifference > 0) {
            winScore *= (1.0 + skillDifference * 0.25); // +25% per skill level difference
          } else if (skillDifference < 0) {
            // Reduced score for beating weaker opponents
            winScore *= (1.0 - Math.abs(skillDifference) * 0.15); // -15% per skill level difference
          }
          
          // Point difference bonus/penalty (winning by more points = better performance)
          const pointBonus = Math.min(pointDifference * 0.1, 0.5); // Max 50% bonus
          winScore *= (1.0 + pointBonus);
          
          matchScore = winScore;
        } else {
          // Base loss score
          let lossScore = -1.0;
          
          // Reduced penalty for losing to stronger opponents
          if (skillDifference > 0) {
            lossScore *= (1.0 - skillDifference * 0.2); // Reduced penalty for losing to stronger
          } else if (skillDifference < 0) {
            // Increased penalty for losing to weaker opponents
            lossScore *= (1.0 + Math.abs(skillDifference) * 0.3); // +30% penalty per skill level
          }
          
          // Point difference consideration (losing by fewer points = better performance)
          const pointPenalty = Math.max(Math.abs(pointDifference) * 0.1, 0.5); // Max 50% additional penalty
          lossScore *= (1.0 + pointPenalty);
          
          matchScore = lossScore;
        }
        
        weightedPerformanceScore += matchScore;
        totalWeight += 1;
      }
      
      // Calculate average weighted performance
      const avgPerformance = totalWeight > 0 ? weightedPerformanceScore / totalWeight : 0;
      let newSkillLevel = player.skillLevel;
      
      // Enhanced skill level adjustment based on weighted performance
      // Only change by 1 level at a time, bounded between 1 and 10
      if (avgPerformance > 0.5 && player.skillLevel < 10) {
        // Strong weighted performance against appropriate opposition - increase by 1
        newSkillLevel = Math.min(player.skillLevel + 1, 10);
      } else if (avgPerformance < -0.5 && player.skillLevel > 1) {
        // Poor weighted performance considering opposition strength - decrease by 1
        newSkillLevel = Math.max(player.skillLevel - 1, 1);
      }
      
      // Additional safety check: ensure skill level is within bounds and only changes by 1
      newSkillLevel = Math.max(1, Math.min(10, newSkillLevel));
      const skillChange = Math.abs(newSkillLevel - player.skillLevel);
      if (skillChange > 1) {
        // This should not happen with the logic above, but adding as a safety net
        newSkillLevel = player.skillLevel + (newSkillLevel > player.skillLevel ? 1 : -1);
      }
      
      // Only actually update skill level if player has 5+ matches
      if (newSkillLevel !== player.skillLevel && shouldAutoUpdate) {
        console.log(`Updating ${player.name} skill level from ${player.skillLevel} to ${newSkillLevel} (weighted performance: ${avgPerformance.toFixed(2)} over ${matchesToAnalyze} matches)`);
        await this.updatePlayerSkillLevel(player.id, newSkillLevel);
      } else if (newSkillLevel !== player.skillLevel && !shouldAutoUpdate) {
        console.log(`Suggestion for ${player.name}: skill level change from ${player.skillLevel} to ${newSkillLevel} (weighted performance: ${avgPerformance.toFixed(2)} over ${matchesToAnalyze} matches) - need ${5 - playerMatches.length} more matches for auto-update`);
      }
    }
  }

  async getSkillLevelSuggestions(): Promise<Array<{ playerId: number; name: string; currentLevel: number; suggestedLevel: number; reason: string; matchesAnalyzed: number; matchesNeeded?: number }>> {
    const allPlayers = await this.getAllPlayers();
    const allMatches = await this.getAllMatches();
    const suggestions: Array<{ playerId: number; name: string; currentLevel: number; suggestedLevel: number; reason: string; matchesAnalyzed: number; matchesNeeded?: number }> = [];
    
    for (const player of allPlayers) {
      const playerMatches = allMatches.filter(match => 
        match.teamAPlayer1Id === player.id ||
        match.teamAPlayer2Id === player.id ||
        match.teamBPlayer1Id === player.id ||
        match.teamBPlayer2Id === player.id
      ).sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());
      
      // Only provide suggestions for players with 3+ matches
      if (playerMatches.length < 3) continue;
      
      const shouldAutoUpdate = playerMatches.length >= 5;
      const matchesToAnalyze = shouldAutoUpdate ? 5 : Math.min(playerMatches.length, 3);
      const recentMatches = playerMatches.slice(0, matchesToAnalyze);
      
      let weightedPerformanceScore = 0;
      let totalWeight = 0;
      
      for (const match of recentMatches) {
        const isTeamA = match.teamAPlayer1Id === player.id || match.teamAPlayer2Id === player.id;
        const teamWon = match.winnerId === 1 ? "A" : "B";
        const playerWon = (isTeamA && teamWon === "A") || (!isTeamA && teamWon === "B");
        
        let opponentSkillLevels: number[] = [];
        let playerScore = 0;
        let opponentScore = 0;
        
        if (isTeamA) {
          const opponent1 = allPlayers.find(p => p.id === match.teamBPlayer1Id);
          const opponent2 = allPlayers.find(p => p.id === match.teamBPlayer2Id);
          if (opponent1) opponentSkillLevels.push(opponent1.skillLevel);
          if (opponent2) opponentSkillLevels.push(opponent2.skillLevel);
          playerScore = match.teamAScore;
          opponentScore = match.teamBScore;
        } else {
          const opponent1 = allPlayers.find(p => p.id === match.teamAPlayer1Id);
          const opponent2 = allPlayers.find(p => p.id === match.teamAPlayer2Id);
          if (opponent1) opponentSkillLevels.push(opponent1.skillLevel);
          if (opponent2) opponentSkillLevels.push(opponent2.skillLevel);
          playerScore = match.teamBScore;
          opponentScore = match.teamAScore;
        }
        
        const avgOpponentSkill = opponentSkillLevels.length > 0 
          ? opponentSkillLevels.reduce((sum, skill) => sum + skill, 0) / opponentSkillLevels.length 
          : player.skillLevel;
        
        const skillDifference = avgOpponentSkill - player.skillLevel;
        const pointDifference = playerScore - opponentScore;
        
        let matchScore = 0;
        if (playerWon) {
          let winScore = 1.0;
          if (skillDifference > 0) {
            winScore *= (1.0 + skillDifference * 0.25);
          } else if (skillDifference < 0) {
            winScore *= (1.0 - Math.abs(skillDifference) * 0.15);
          }
          const pointBonus = Math.min(pointDifference * 0.1, 0.5);
          winScore *= (1.0 + pointBonus);
          matchScore = winScore;
        } else {
          let lossScore = -1.0;
          if (skillDifference > 0) {
            lossScore *= (1.0 - skillDifference * 0.2);
          } else if (skillDifference < 0) {
            lossScore *= (1.0 + Math.abs(skillDifference) * 0.3);
          }
          const pointPenalty = Math.max(Math.abs(pointDifference) * 0.1, 0.5);
          lossScore *= (1.0 + pointPenalty);
          matchScore = lossScore;
        }
        
        weightedPerformanceScore += matchScore;
        totalWeight += 1;
      }
      
      const avgPerformance = totalWeight > 0 ? weightedPerformanceScore / totalWeight : 0;
      let suggestedLevel = player.skillLevel;
      
      // Only suggest 1 level change at a time, bounded between 1 and 10
      if (avgPerformance > 0.5 && player.skillLevel < 10) {
        suggestedLevel = Math.min(player.skillLevel + 1, 10);
      } else if (avgPerformance < -0.5 && player.skillLevel > 1) {
        suggestedLevel = Math.max(player.skillLevel - 1, 1);
      }
      
      // Additional safety check for suggestions: ensure bounds and single-level change
      suggestedLevel = Math.max(1, Math.min(10, suggestedLevel));
      const skillChange = Math.abs(suggestedLevel - player.skillLevel);
      if (skillChange > 1) {
        suggestedLevel = player.skillLevel + (suggestedLevel > player.skillLevel ? 1 : -1);
      }
      
      if (suggestedLevel !== player.skillLevel) {
        let reason = "";
        if (suggestedLevel > player.skillLevel) {
          reason = `Strong performance against opponents (weighted score: ${avgPerformance.toFixed(2)})`;
        } else {
          reason = `Challenging performance against opponents (weighted score: ${avgPerformance.toFixed(2)})`;
        }
        
        const suggestion = {
          playerId: player.id,
          name: player.name,
          currentLevel: player.skillLevel,
          suggestedLevel,
          reason,
          matchesAnalyzed: matchesToAnalyze,
          ...(shouldAutoUpdate ? {} : { matchesNeeded: 5 - playerMatches.length })
        };
        
        suggestions.push(suggestion);
      }
    }
    
    return suggestions;
  }

  async recalculateAllSkillLevels(): Promise<void> {
    const allPlayers = await this.getAllPlayers();
    
    // First, ensure all existing players have originalSkillLevel set
    for (const player of allPlayers) {
      if (player.originalSkillLevel === null || player.originalSkillLevel === undefined) {
        await db
          .update(players)
          .set({ originalSkillLevel: player.skillLevel })
          .where(eq(players.id, player.id));
      }
    }
    
    // Reset all players to their original skill levels (before any auto-adjustments)
    for (const player of allPlayers) {
      await db
        .update(players)
        .set({
          skillLevel: player.originalSkillLevel || player.skillLevel,
          previousSkillLevel: null,
          lastSkillUpdate: null,
        })
        .where(eq(players.id, player.id));
    }
    
    // Now recalculate skill levels based on current match history
    await this.checkForSkillLevelUpdates();
  }

  async resetAllPlayersToLevel5(): Promise<void> {
    const allPlayers = await this.getAllPlayers();
    
    console.log("Resetting all players to skill level 5...");
    
    // Set all players to skill level 5 and update their original skill level
    for (const player of allPlayers) {
      await db
        .update(players)
        .set({
          skillLevel: 5,
          originalSkillLevel: 5, // Set original to 5 as the new baseline
          previousSkillLevel: player.skillLevel, // Store their previous level
          lastSkillUpdate: new Date(),
        })
        .where(eq(players.id, player.id));
      
      console.log(`Reset ${player.name} from skill level ${player.skillLevel} to 5`);
    }
    
    console.log("Running dynamic skill level calculations...");
    
    // Now run the dynamic skill level calculation logic
    await this.checkForSkillLevelUpdates();
    
    console.log("Skill level reset and recalculation completed!");
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
