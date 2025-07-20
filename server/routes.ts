import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPlayerSchema, insertMatchSchema, type Player, type DoublesTeam } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
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
        } else {
          const targetSkill = skillFilter.replace(" Only", "");
          filteredPlayers = players.filter(p => p.skillLevel === targetSkill);
        }
      }

      const pairs: DoublesTeam[] = [];
      
      for (let i = 0; i < filteredPlayers.length; i++) {
        for (let j = i + 1; j < filteredPlayers.length; j++) {
          const player1 = filteredPlayers[i];
          const player2 = filteredPlayers[j];
          
          // Determine balance level
          const skillLevels = ["Beginner", "Intermediate", "Advanced"];
          const p1Level = skillLevels.indexOf(player1.skillLevel);
          const p2Level = skillLevels.indexOf(player2.skillLevel);
          const skillDiff = Math.abs(p1Level - p2Level);
          
          const balanceLevel = skillDiff <= 1 ? "Balanced" : "Unbalanced";
          
          pairs.push({
            player1,
            player2,
            balanceLevel,
          });
        }
      }

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
