import { players, matches, type Player, type InsertPlayer, type Match, type InsertMatch, type PlayerStats } from "@shared/schema";

export interface IStorage {
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
}

export class MemStorage implements IStorage {
  private players: Map<number, Player>;
  private matches: Map<number, Match>;
  private currentPlayerId: number;
  private currentMatchId: number;

  constructor() {
    this.players = new Map();
    this.matches = new Map();
    this.currentPlayerId = 1;
    this.currentMatchId = 1;
  }

  // Player management
  async getPlayer(id: number): Promise<Player | undefined> {
    return this.players.get(id);
  }

  async getAllPlayers(): Promise<Player[]> {
    return Array.from(this.players.values());
  }

  async createPlayer(insertPlayer: InsertPlayer): Promise<Player> {
    const id = this.currentPlayerId++;
    const player: Player = { ...insertPlayer, id };
    this.players.set(id, player);
    return player;
  }

  async updatePlayer(id: number, updates: Partial<InsertPlayer>): Promise<Player> {
    const existingPlayer = this.players.get(id);
    if (!existingPlayer) {
      throw new Error(`Player with id ${id} not found`);
    }
    const updatedPlayer: Player = { ...existingPlayer, ...updates };
    this.players.set(id, updatedPlayer);
    return updatedPlayer;
  }

  async deletePlayer(id: number): Promise<boolean> {
    return this.players.delete(id);
  }

  // Match management
  async getMatch(id: number): Promise<Match | undefined> {
    return this.matches.get(id);
  }

  async getAllMatches(): Promise<Match[]> {
    return Array.from(this.matches.values()).sort((a, b) => 
      new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
    );
  }

  async createMatch(insertMatch: InsertMatch): Promise<Match> {
    const id = this.currentMatchId++;
    const match: Match = { 
      ...insertMatch, 
      id, 
      playedAt: new Date() 
    };
    this.matches.set(id, match);
    return match;
  }

  // Statistics
  async getPlayerStats(playerId?: number): Promise<PlayerStats[]> {
    const allPlayers = Array.from(this.players.values());
    const allMatches = Array.from(this.matches.values());
    
    const statsMap = new Map<number, PlayerStats>();
    
    // Initialize stats for all players
    allPlayers.forEach(player => {
      statsMap.set(player.id, {
        playerId: player.id,
        name: player.name,
        skillLevel: player.skillLevel,
        totalMatches: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
      });
    });

    // Calculate stats from matches
    allMatches.forEach(match => {
      const teamAPlayers = [match.teamAPlayer1Id, match.teamAPlayer2Id];
      const teamBPlayers = [match.teamBPlayer1Id, match.teamBPlayer2Id];
      const teamAWon = match.winnerId === 1;

      [...teamAPlayers, ...teamBPlayers].forEach(pId => {
        const stats = statsMap.get(pId);
        if (stats) {
          stats.totalMatches++;
          if (teamAPlayers.includes(pId) && teamAWon) {
            stats.wins++;
          } else if (teamBPlayers.includes(pId) && !teamAWon) {
            stats.wins++;
          } else {
            stats.losses++;
          }
          stats.winRate = stats.totalMatches > 0 ? Math.round((stats.wins / stats.totalMatches) * 100) : 0;
        }
      });
    });

    const result = Array.from(statsMap.values()).sort((a, b) => b.winRate - a.winRate);
    
    if (playerId) {
      return result.filter(stats => stats.playerId === playerId);
    }
    
    return result;
  }
}

export const storage = new MemStorage();
