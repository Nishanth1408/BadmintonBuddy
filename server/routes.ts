import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPlayerSchema, insertMatchSchema, type Player, type DoublesTeam, type SetupRequest, type AuthUser } from "@shared/schema";
import { z } from "zod";

const setupRequestSchema = z.object({
  managerName: z.string().min(1),
  managerSkillLevel: z.number().min(1).max(10),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.get("/api/auth/status", async (req, res) => {
    try {
      const isInitialized = await storage.isInitialized();
      const currentUser = await storage.getCurrentUser();
      
      res.json({
        initialized: isInitialized,
        user: currentUser,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get auth status" });
    }
  });

  app.post("/api/auth/setup", async (req, res) => {
    try {
      const isInitialized = await storage.isInitialized();
      if (isInitialized) {
        return res.status(400).json({ error: "System already initialized" });
      }

      const setupData = setupRequestSchema.parse(req.body);
      const manager = await storage.setupInitialManager(setupData);
      
      res.status(201).json(manager);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid setup data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to setup manager" });
      }
    }
  });

  app.post("/api/auth/login/:id", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      await storage.setCurrentUser(userId);
      const currentUser = await storage.getCurrentUser();
      
      if (!currentUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(currentUser);
    } catch (error) {
      res.status(500).json({ error: "Failed to login" });
    }
  });

  // Data reset endpoint - Manager only
  app.post("/api/auth/reset", async (req, res) => {
    try {
      const currentUser = await storage.getCurrentUser();
      
      if (!currentUser || currentUser.role !== "manager") {
        return res.status(403).json({ error: "Only managers can reset data" });
      }
      
      await storage.resetAllData();
      res.json({ message: "All data has been reset successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to reset data" });
    }
  });

  // Player routes
  app.get("/api/players", async (req, res) => {
    try {
      const players = await storage.getAllPlayers();
      res.json(players);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch players" });
    }
  });

  app.post("/api/players", async (req, res) => {
    try {
      const playerData = insertPlayerSchema.parse(req.body);
      const player = await storage.createPlayer(playerData);
      res.status(201).json(player);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid player data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create player" });
      }
    }
  });

  app.put("/api/players/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const playerData = insertPlayerSchema.partial().parse(req.body);
      const player = await storage.updatePlayer(id, playerData);
      res.json(player);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid player data", details: error.errors });
      } else {
        res.status(404).json({ error: "Player not found" });
      }
    }
  });

  app.delete("/api/players/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deletePlayer(id);
      if (deleted) {
        res.status(204).send();
      } else {
        res.status(404).json({ error: "Player not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to delete player" });
    }
  });

  // Doubles pairs generation
  app.get("/api/pairs", async (req, res) => {
    try {
      const players = await storage.getAllPlayers();
      const skillFilter = req.query.skillLevel as string;
      
      let filteredPlayers = players;
      if (skillFilter && skillFilter !== "All Skill Levels") {
        if (skillFilter === "Mixed Levels") {
          // Don't filter, use all players
        } else if (skillFilter === "Beginner (1-3)") {
          filteredPlayers = players.filter(p => p.skillLevel >= 1 && p.skillLevel <= 3);
        } else if (skillFilter === "Intermediate (4-7)") {
          filteredPlayers = players.filter(p => p.skillLevel >= 4 && p.skillLevel <= 7);
        } else if (skillFilter === "Advanced (8-10)") {
          filteredPlayers = players.filter(p => p.skillLevel >= 8 && p.skillLevel <= 10);
        }
      }

      const pairs: DoublesTeam[] = [];
      
      for (let i = 0; i < filteredPlayers.length; i++) {
        for (let j = i + 1; j < filteredPlayers.length; j++) {
          const player1 = filteredPlayers[i];
          const player2 = filteredPlayers[j];
          
          // Determine balance level based on skill difference (1-10 scale)
          const skillDiff = Math.abs(player1.skillLevel - player2.skillLevel);
          
          const balanceLevel = skillDiff <= 2 ? "Balanced" : "Unbalanced";
          
          pairs.push({
            player1,
            player2,
            balanceLevel,
            skillScore: player1.skillLevel + player2.skillLevel,
          });
        }
      }

      // Sort pairs by skill score in descending order
      pairs.sort((a, b) => b.skillScore - a.skillScore);
      
      res.json(pairs);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate pairs" });
    }
  });

  // Match routes
  app.get("/api/matches", async (req, res) => {
    try {
      const matches = await storage.getAllMatches();
      res.json(matches);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch matches" });
    }
  });

  app.post("/api/matches", async (req, res) => {
    try {
      const matchData = insertMatchSchema.parse(req.body);
      
      // Validate that all players exist
      const players = await storage.getAllPlayers();
      const playerIds = [matchData.teamAPlayer1Id, matchData.teamAPlayer2Id, 
                        matchData.teamBPlayer1Id, matchData.teamBPlayer2Id];
      
      for (const playerId of playerIds) {
        if (!players.find(p => p.id === playerId)) {
          return res.status(400).json({ error: `Player with id ${playerId} not found` });
        }
      }

      // Validate no duplicate players
      const uniquePlayerIds = new Set(playerIds);
      if (uniquePlayerIds.size !== 4) {
        return res.status(400).json({ error: "All four players must be different" });
      }

      // Determine winner based on scores  
      const winnerId = matchData.teamAScore > matchData.teamBScore ? 1 : 2;
      const finalMatchData = { ...matchData, winnerId };

      const match = await storage.createMatch(finalMatchData);
      res.status(201).json(match);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid match data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create match" });
      }
    }
  });

  // Statistics routes
  app.get("/api/stats", async (req, res) => {
    try {
      const playerStats = await storage.getPlayerStats();
      const matches = await storage.getAllMatches();
      const players = await storage.getAllPlayers();
      
      // Calculate team statistics
      const teamStatsMap = new Map<string, {
        player1: any,
        player2: any,
        skillScore: number,
        totalMatches: number,
        wins: number,
        losses: number
      }>();

      for (const match of matches) {
        // Team A
        const teamAKey = [match.teamAPlayer1Id, match.teamAPlayer2Id].sort().join('-');
        const teamAPlayer1 = players.find(p => p.id === match.teamAPlayer1Id);
        const teamAPlayer2 = players.find(p => p.id === match.teamAPlayer2Id);
        
        if (teamAPlayer1 && teamAPlayer2) {
          if (!teamStatsMap.has(teamAKey)) {
            teamStatsMap.set(teamAKey, {
              player1: teamAPlayer1,
              player2: teamAPlayer2,
              skillScore: teamAPlayer1.skillLevel + teamAPlayer2.skillLevel,
              totalMatches: 0,
              wins: 0,
              losses: 0
            });
          }
          
          const teamAStat = teamStatsMap.get(teamAKey)!;
          teamAStat.totalMatches++;
          if (match.winnerId === 1) teamAStat.wins++;
          else teamAStat.losses++;
        }

        // Team B
        const teamBKey = [match.teamBPlayer1Id, match.teamBPlayer2Id].sort().join('-');
        const teamBPlayer1 = players.find(p => p.id === match.teamBPlayer1Id);
        const teamBPlayer2 = players.find(p => p.id === match.teamBPlayer2Id);
        
        if (teamBPlayer1 && teamBPlayer2) {
          if (!teamStatsMap.has(teamBKey)) {
            teamStatsMap.set(teamBKey, {
              player1: teamBPlayer1,
              player2: teamBPlayer2,
              skillScore: teamBPlayer1.skillLevel + teamBPlayer2.skillLevel,
              totalMatches: 0,
              wins: 0,
              losses: 0
            });
          }
          
          const teamBStat = teamStatsMap.get(teamBKey)!;
          teamBStat.totalMatches++;
          if (match.winnerId === 2) teamBStat.wins++;
          else teamBStat.losses++;
        }
      }

      const teamStats = Array.from(teamStatsMap.values()).map(team => ({
        ...team,
        winRate: team.totalMatches > 0 ? Math.round((team.wins / team.totalMatches) * 100) : 0
      }));
      
      // Calculate additional stats
      const totalMatches = matches.length;
      const activePlayers = players.length;
      
      // Calculate weekly matches (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weeklyMatches = matches.filter(match => 
        new Date(match.playedAt) >= weekAgo
      ).length;

      res.json({
        playerStats,
        teamStats,
        totalMatches,
        activePlayers,
        weeklyMatches,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
