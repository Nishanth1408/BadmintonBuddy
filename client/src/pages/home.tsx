import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Users, UserPlus, Trophy, BarChart3, PlayCircle, Plus, Edit, Trash2, RefreshCw } from "lucide-react";
import PlayerForm from "../components/player-form";
import MatchForm from "../components/match-form";
import type { Player, Match, PlayerStats, DoublesTeam } from "@shared/schema";

export default function Home() {
  const [activeTab, setActiveTab] = useState("players");
  const [playerFormOpen, setPlayerFormOpen] = useState(false);
  const [matchFormOpen, setMatchFormOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [skillFilter, setSkillFilter] = useState("All Skill Levels");
  const { toast } = useToast();

  // Queries
  const { data: players = [], isLoading: playersLoading } = useQuery<Player[]>({
    queryKey: ["/api/players"],
  });

  const { data: matches = [], isLoading: matchesLoading } = useQuery<Match[]>({
    queryKey: ["/api/matches"],
  });

  const { data: pairs = [], isLoading: pairsLoading } = useQuery<DoublesTeam[]>({
    queryKey: ["/api/pairs", skillFilter],
    enabled: activeTab === "pairs",
  });

  const { data: statsData, isLoading: statsLoading } = useQuery<{
    playerStats: PlayerStats[];
    totalMatches: number;
    activePlayers: number;
    weeklyMatches: number;
  }>({
    queryKey: ["/api/stats"],
    enabled: activeTab === "stats",
  });

  // Mutations
  const deletePlayerMutation = useMutation({
    mutationFn: async (playerId: number) => {
      return apiRequest("DELETE", `/api/players/${playerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Player deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete player", variant: "destructive" });
    },
  });

  const handleEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setPlayerFormOpen(true);
  };

  const handleDeletePlayer = async (playerId: number) => {
    if (confirm("Are you sure you want to delete this player?")) {
      deletePlayerMutation.mutate(playerId);
    }
  };

  const getPlayerInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  const getSkillLevelColor = (level: string) => {
    switch (level) {
      case "Advanced": return "bg-green-500";
      case "Intermediate": return "bg-yellow-500";
      case "Beginner": return "bg-blue-500";
      default: return "bg-gray-500";
    }
  };

  const getPlayerAvatarColor = (index: number) => {
    const colors = ["bg-blue-500", "bg-orange-500", "bg-purple-500", "bg-indigo-500", "bg-pink-500"];
    return colors[index % colors.length];
  };

  const getMatchTeamPlayers = (match: Match, teamType: "A" | "B") => {
    const player1Id = teamType === "A" ? match.teamAPlayer1Id : match.teamBPlayer1Id;
    const player2Id = teamType === "A" ? match.teamAPlayer2Id : match.teamBPlayer2Id;
    
    const player1 = players.find(p => p.id === player1Id);
    const player2 = players.find(p => p.id === player2Id);
    
    return { player1, player2 };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 text-white rounded-lg p-2">
                <Trophy className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Badminton Club Manager</h1>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-4 w-80">
                  <TabsTrigger value="players" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Players
                  </TabsTrigger>
                  <TabsTrigger value="pairs" className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Pairs
                  </TabsTrigger>
                  <TabsTrigger value="matches" className="flex items-center gap-2">
                    <Trophy className="h-4 w-4" />
                    Matches
                  </TabsTrigger>
                  <TabsTrigger value="stats" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Stats
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full h-16 bg-transparent rounded-none">
            <TabsTrigger value="players" className="flex-col gap-1 h-full data-[state=active]:text-blue-600">
              <Users className="h-5 w-5" />
              <span className="text-xs">Players</span>
            </TabsTrigger>
            <TabsTrigger value="pairs" className="flex-col gap-1 h-full data-[state=active]:text-blue-600">
              <UserPlus className="h-5 w-5" />
              <span className="text-xs">Pairs</span>
            </TabsTrigger>
            <TabsTrigger value="matches" className="flex-col gap-1 h-full data-[state=active]:text-blue-600">
              <Trophy className="h-5 w-5" />
              <span className="text-xs">Matches</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex-col gap-1 h-full data-[state=active]:text-blue-600">
              <BarChart3 className="h-5 w-5" />
              <span className="text-xs">Stats</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Players Tab */}
          <TabsContent value="players">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Player Management</h2>
                <p className="text-gray-600 mt-1">Manage club members and their skill levels</p>
              </div>
              <Dialog open={playerFormOpen} onOpenChange={setPlayerFormOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Player
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingPlayer ? "Edit Player" : "Add New Player"}</DialogTitle>
                  </DialogHeader>
                  <PlayerForm
                    player={editingPlayer}
                    onSuccess={() => {
                      setPlayerFormOpen(false);
                      setEditingPlayer(null);
                    }}
                  />
                </DialogContent>
              </Dialog>
            </div>

            {playersLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-4 bg-gray-300 rounded w-3/4 mb-4"></div>
                      <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : players.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No players yet</h3>
                  <p className="text-gray-500 mb-4">Get started by adding your first player to the club.</p>
                  <Dialog open={playerFormOpen} onOpenChange={setPlayerFormOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Player
                      </Button>
                    </DialogTrigger>
                  </Dialog>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {players.map((player, index) => {
                  const stats = statsData?.playerStats.find(s => s.playerId === player.id);
                  return (
                    <Card key={player.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className={`w-12 h-12 ${getPlayerAvatarColor(index)} text-white rounded-full flex items-center justify-center font-semibold`}>
                              {getPlayerInitials(player.name)}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{player.name}</h3>
                              <div className="flex items-center space-x-2">
                                <span className="text-sm text-gray-600">Skill Level:</span>
                                <Badge className={`${getSkillLevelColor(player.skillLevel)} text-white text-xs`}>
                                  {player.skillLevel}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditPlayer(player)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletePlayer(player.id)}
                              disabled={deletePlayerMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        {stats && (
                          <div className="grid grid-cols-3 gap-4 text-center pt-4 border-t border-gray-100">
                            <div>
                              <div className="text-lg font-bold text-green-600">{stats.wins}</div>
                              <div className="text-xs text-gray-500">Wins</div>
                            </div>
                            <div>
                              <div className="text-lg font-bold text-red-500">{stats.losses}</div>
                              <div className="text-xs text-gray-500">Losses</div>
                            </div>
                            <div>
                              <div className="text-lg font-bold text-gray-600">{stats.winRate}%</div>
                              <div className="text-xs text-gray-500">Win Rate</div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Pairs Tab */}
          <TabsContent value="pairs">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Doubles Pairs</h2>
                <p className="text-gray-600 mt-1">Generate balanced team combinations</p>
              </div>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
                <Select value={skillFilter} onValueChange={setSkillFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Skill Levels">All Skill Levels</SelectItem>
                    <SelectItem value="Advanced Only">Advanced Only</SelectItem>
                    <SelectItem value="Intermediate Only">Intermediate Only</SelectItem>
                    <SelectItem value="Beginner Only">Beginner Only</SelectItem>
                    <SelectItem value="Mixed Levels">Mixed Levels</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/pairs"] })}
                  disabled={pairsLoading}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Generate Pairs
                </Button>
              </div>
            </div>

            {pairsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-4 bg-gray-300 rounded w-3/4 mb-4"></div>
                      <div className="h-3 bg-gray-300 rounded w-1/2 mb-2"></div>
                      <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : pairs.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <UserPlus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No pairs available</h3>
                  <p className="text-gray-500">Add more players to generate doubles pairs.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {pairs.map((pair, index) => (
                  <Card key={index}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900">Team {String.fromCharCode(65 + index)}</h3>
                        <Badge
                          variant={pair.balanceLevel === "Balanced" ? "default" : "secondary"}
                          className={pair.balanceLevel === "Balanced" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}
                        >
                          {pair.balanceLevel}
                        </Badge>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 ${getPlayerAvatarColor(players.findIndex(p => p.id === pair.player1.id))} text-white rounded-full flex items-center justify-center font-semibold text-sm`}>
                            {getPlayerInitials(pair.player1.name)}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{pair.player1.name}</div>
                            <div className="text-sm text-gray-500">{pair.player1.skillLevel}</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 ${getPlayerAvatarColor(players.findIndex(p => p.id === pair.player2.id))} text-white rounded-full flex items-center justify-center font-semibold text-sm`}>
                            {getPlayerInitials(pair.player2.name)}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{pair.player2.name}</div>
                            <div className="text-sm text-gray-500">{pair.player2.skillLevel}</div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <Dialog open={matchFormOpen} onOpenChange={setMatchFormOpen}>
                          <DialogTrigger asChild>
                            <Button className="w-full bg-green-600 hover:bg-green-700">
                              <PlayCircle className="h-4 w-4 mr-2" />
                              Start Match
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Record New Match</DialogTitle>
                            </DialogHeader>
                            <MatchForm
                              preselectedTeamA={[pair.player1.id, pair.player2.id]}
                              onSuccess={() => setMatchFormOpen(false)}
                            />
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Matches Tab */}
          <TabsContent value="matches">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Match Management</h2>
                <p className="text-gray-600 mt-1">Record games and track results</p>
              </div>
              <Dialog open={matchFormOpen} onOpenChange={setMatchFormOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Record Match
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Record New Match</DialogTitle>
                  </DialogHeader>
                  <MatchForm onSuccess={() => setMatchFormOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>

            {/* Quick Match Form */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Quick Match Recording</CardTitle>
              </CardHeader>
              <CardContent>
                <MatchForm onSuccess={() => {}} embedded />
              </CardContent>
            </Card>

            {/* Match History */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Matches</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {matchesLoading ? (
                  <div className="divide-y divide-gray-200">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="p-6 animate-pulse">
                        <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : matches.length === 0 ? (
                  <div className="p-12 text-center">
                    <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No matches recorded</h3>
                    <p className="text-gray-500">Start recording matches to build your club's history.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {matches.map((match) => {
                      const teamA = getMatchTeamPlayers(match, "A");
                      const teamB = getMatchTeamPlayers(match, "B");
                      const teamAWon = match.winnerId === 1;
                      
                      return (
                        <div key={match.id} className="p-6 hover:bg-gray-50 transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
                            <div className="flex-1">
                              <div className="flex items-center space-x-4 mb-2">
                                <div className="flex items-center space-x-2">
                                  <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">A</span>
                                  <span className="font-medium">
                                    {teamA.player1?.name} & {teamA.player2?.name}
                                  </span>
                                </div>
                                <span className="text-gray-400">vs</span>
                                <div className="flex items-center space-x-2">
                                  <span className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs">B</span>
                                  <span className="font-medium">
                                    {teamB.player1?.name} & {teamB.player2?.name}
                                  </span>
                                </div>
                              </div>
                              <div className="text-sm text-gray-500">
                                {new Date(match.playedAt).toLocaleDateString()} • {new Date(match.playedAt).toLocaleTimeString()}
                              </div>
                            </div>
                            <div className="flex items-center space-x-4">
                              <div className="text-right">
                                <div className="text-2xl font-bold text-gray-900">
                                  {match.teamAScore} - {match.teamBScore}
                                </div>
                                <div className="text-sm text-green-600 font-medium">
                                  Team {teamAWon ? "A" : "B"} Wins
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Statistics & Leaderboard</h2>
              <p className="text-gray-600 mt-1">Track performance and rankings</p>
            </div>

            {/* Quick Stats Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Matches</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {statsLoading ? "..." : statsData?.totalMatches || 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-blue-600 bg-opacity-10 rounded-lg flex items-center justify-center">
                      <Trophy className="text-blue-600 text-xl" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active Players</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {statsLoading ? "..." : statsData?.activePlayers || 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-green-600 bg-opacity-10 rounded-lg flex items-center justify-center">
                      <Users className="text-green-600 text-xl" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">This Week</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {statsLoading ? "..." : statsData?.weeklyMatches || 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-orange-600 bg-opacity-10 rounded-lg flex items-center justify-center">
                      <BarChart3 className="text-orange-600 text-xl" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Leaderboard */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Player Leaderboard</CardTitle>
                  <Select defaultValue="all-time">
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-time">All Time</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {statsLoading ? (
                  <div className="divide-y divide-gray-200">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="p-6 animate-pulse">
                        <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : !statsData?.playerStats.length ? (
                  <div className="p-12 text-center">
                    <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No statistics yet</h3>
                    <p className="text-gray-500">Record some matches to see player statistics.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {statsData.playerStats.map((playerStat, index) => (
                      <div key={playerStat.playerId} className="p-6 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-8 h-8 flex items-center justify-center">
                            <span className="text-lg font-bold text-gray-600">{index + 1}</span>
                          </div>
                          <div className={`w-12 h-12 ${getPlayerAvatarColor(index)} text-white rounded-full flex items-center justify-center font-semibold`}>
                            {getPlayerInitials(playerStat.name)}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{playerStat.name}</h4>
                            <p className="text-sm text-gray-500">{playerStat.skillLevel}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-6">
                          <div className="text-center">
                            <p className="text-lg font-bold text-gray-900">{playerStat.totalMatches}</p>
                            <p className="text-xs text-gray-500">Matches</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-green-600">{playerStat.wins}</p>
                            <p className="text-xs text-gray-500">Wins</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-gray-900">{playerStat.winRate}%</p>
                            <p className="text-xs text-gray-500">Win Rate</p>
                          </div>
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-600" 
                              style={{ width: `${playerStat.winRate}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
